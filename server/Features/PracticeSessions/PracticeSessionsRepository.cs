using System.Text.Json;

using EduBoost.API.Features.LearningStates;

using EduBoost.API.Features.LearningStates.Models;

using EduBoost.API.Features.Roadmap;

using EduBoost.API.Features.PracticeSessions.Models;

using EduBoost.API.Infrastructure;

using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EduBoost.API.Features.PracticeSessions;



public interface IPracticeSessionsRepository

{

    Task<StartPracticeResponse> StartSessionAsync(Guid userId, StartPracticeRequest request);

    Task<SubmitAnswerResponse> SubmitAnswerAsync(Guid userId, SubmitAnswerRequest request);

    Task<PracticeSessionSummary> EndSessionAsync(Guid userId, string sessionId);

}



public partial class PracticeSessionsRepository : IPracticeSessionsRepository

{
    private readonly AppDbContext db;
    private readonly ILearningEvidenceService learningEvidence;
    private readonly IRoadmapRepository roadmap;

    private readonly PracticeSessionStore _sessionStore;
    private readonly bool _agentDecisionEnabled;
    private readonly double _selfPracticeMasteryThreshold;
    private readonly IAgentService? _agentService;
    private readonly ILogger<PracticeSessionsRepository>? _logger;

    public PracticeSessionsRepository(
        AppDbContext db,
        ILearningEvidenceService learningEvidence,
        IRoadmapRepository roadmap,
        IAgentService? agentService = null,
        ILogger<PracticeSessionsRepository>? logger = null,
        IConfiguration? configuration = null)
    {
        this.db = db;
        this.learningEvidence = learningEvidence;
        this.roadmap = roadmap;
        _sessionStore = new PracticeSessionStore(db);
        _agentDecisionEnabled = configuration?.GetValue("Features:AgentDecisionEnabled", true) ?? true;
        _selfPracticeMasteryThreshold = configuration?.GetValue("Features:SelfPracticeMasteryThreshold", 0.95) ?? 0.95;
        _agentService = agentService;
        _logger = logger;
    }



    private async Task<Guid> ResolveSessionTopicIdAsync(StartPracticeRequest request, List<Question> questions)

    {

        if (request.TopicId.HasValue && request.TopicId.Value != Guid.Empty)

            return request.TopicId.Value;



        var fromFirst = questions.Select(ResolveQuestionTopicId).FirstOrDefault(id => id.HasValue);

        if (fromFirst.HasValue)

            return fromFirst.Value;



        if (request.QuizId.HasValue)

        {

            var quiz = await db.Quizzes.AsNoTracking().FirstOrDefaultAsync(q => q.Id == request.QuizId.Value);

            if (quiz?.TopicId is Guid quizTopicId) return quizTopicId;

            if (quiz?.ClassId is Guid classId)

            {

                var classTopicId = await db.Topics

                    .Where(t => t.ClassId == classId)

                    .OrderBy(t => t.CreatedAt)

                    .Select(t => t.Id)

                    .FirstOrDefaultAsync();

                if (classTopicId != Guid.Empty) return classTopicId;

            }

        }



        throw new InvalidOperationException("Câu hỏi không thuộc chủ đề hợp lệ");

    }



    private static Guid? ResolveQuestionTopicId(Question question) =>

        question.SourceTopicId ?? question.Quiz?.TopicId;



    private async Task ReorderRemainingQuestionsByThetaAsync(PracticeSessionState state, double theta)
    {
        if (state.CurrentIndex >= state.Questions.Count) return;

        var remainingIds = state.Questions.Skip(state.CurrentIndex).ToList();
        var remainingSet = remainingIds.ToHashSet();
        var remainingQuestions = await db.Questions
            .Where(q => remainingSet.Contains(q.Id))
            .Select(q => new { q.Id, Beta = q.IrtItem.Beta })
            .ToListAsync();

        var ordered = remainingQuestions
            .OrderBy(q => Math.Abs(q.Beta - theta))
            .Select(q => q.Id)
            .ToList();

        for (var i = 0; i < ordered.Count; i++)
            state.Questions[state.CurrentIndex + i] = ordered[i];
    }

    private async Task<(string? Action, string? Reason, string? Explanation, bool RecommendNextSkill, string? NextSkillSuggestion, double? TargetBeta, string? SuggestedNextTopicId, string? SuggestedNextTopicName)>
        ResolveAgentDecisionAsync(Guid userId, PracticeSessionState state, double mastery, double theta)
    {
        var isSelfPractice = string.Equals(state.Mode, "self_practice", StringComparison.OrdinalIgnoreCase);

        if (isSelfPractice && mastery >= _selfPracticeMasteryThreshold && state.ClassId.HasValue)
        {
            var nextTopic = await SuggestWeakestTopicAsync(userId, state.ClassId.Value, state.TopicId);
            if (nextTopic != null)
            {
                return (
                    "QUIZ",
                    $"Bạn đã đạt mức thành thạo {mastery:P0} cho chủ đề này, nhưng vẫn có thể tiếp tục tự luyện tập.",
                    null,
                    true,
                    $"Bạn có thể chuyển sang chủ đề: {nextTopic.Name}",
                    IrtScale.Clamp(theta),
                    nextTopic.Id.ToString(),
                    nextTopic.Name
                );
            }
        }

        var fallbackAction = mastery < 0.5 ? "EXPLAIN" : isSelfPractice || mastery < 0.95 ? "QUIZ" : "NEXT_SKILL";
        var fallbackReason = $"Fallback decision from mastery={mastery:F2}";
        var fallbackTargetBeta = IrtScale.Clamp(theta);

        if (!_agentDecisionEnabled || _agentService == null)
            return (fallbackAction, fallbackReason, null, fallbackAction == "NEXT_SKILL", null, fallbackTargetBeta, null, null);

        var response = await _agentService.GetNextActionAsync(userId.ToString(), state.TopicName, mastery, theta);
        var action = response?.Action?.Trim().ToUpperInvariant();
        if (action is not ("EXPLAIN" or "QUIZ" or "NEXT_SKILL"))
        {
            _logger?.LogWarning("Invalid agent action '{Action}' for topic {Topic}; using fallback", response?.Action, state.TopicName);
            action = fallbackAction;
        }
        else if (isSelfPractice && action == "NEXT_SKILL")
        {
            action = "QUIZ";
        }

        var reason = string.IsNullOrWhiteSpace(response?.Reason) ? fallbackReason : response!.Reason;
        var targetBeta = fallbackTargetBeta;
        if (response?.Params != null &&
            response.Params.TryGetValue("beta", out var betaObj) &&
            double.TryParse(Convert.ToString(betaObj), out var parsedBeta))
        {
            targetBeta = IrtScale.Clamp(parsedBeta);
        }

        string? explanation = null;
        if (action == "EXPLAIN")
        {
            var studentState = mastery < 0.5 ? "beginning" : mastery < 0.95 ? "learning" : "reviewing";
            explanation = await _agentService.GetExplanationAsync(state.TopicName, studentState);
        }

        return (
            action,
            reason,
            explanation,
            action == "NEXT_SKILL",
            action == "NEXT_SKILL" ? "Bạn nên chuyển sang chủ đề kế tiếp." : null,
            targetBeta,
            null,
            null
        );
    }

    private async Task<Topic?> SuggestWeakestTopicAsync(Guid userId, Guid classId, Guid currentTopicId)
    {
        var classTopicIds = await db.Topics
            .Where(t => t.ClassId == classId && t.Id != currentTopicId)
            .Select(t => t.Id)
            .ToListAsync();

        if (classTopicIds.Count == 0) return null;

        var states = await db.BktStates
            .Where(b => b.UserId == userId && classTopicIds.Contains(b.TopicId))
            .Include(b => b.Topic)
            .ToListAsync();

        var weakest = classTopicIds
            .Select(topicId =>
            {
                var state = states.FirstOrDefault(s => s.TopicId == topicId);
                return new { TopicId = topicId, Mastery = state?.MasteryProbability ?? 0.3, Topic = state?.Topic };
            })
            .Where(x => x.Mastery < _selfPracticeMasteryThreshold)
            .OrderBy(x => x.Mastery)
            .FirstOrDefault();

        if (weakest == null) return null;

        if (weakest.Topic != null) return weakest.Topic;

        return await db.Topics.FindAsync(weakest.TopicId);
    }



    private static PracticeQuestionDto MapQuestionDto(Question q) => new()

    {

        QuestionId = q.Id.ToString(),

        Text = q.Text,

        Type = q.Type,

        DifficultyBand = IrtScale.BandFromBeta(q.IrtItem.Beta),

        IrtBeta = q.IrtItem.Beta,

        Options = q.Options.OrderBy(o => o.OrderIndex).Select(o => new PracticeOptionDto

        {

            Id = o.Id.ToString(),

            Text = o.Text

        }).ToList()

    };



}
