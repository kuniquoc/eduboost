using System.Text.Json;

using EduBoost.API.Features.LearningStates;

using EduBoost.API.Features.LearningStates.Models;

using EduBoost.API.Features.Roadmap;

using EduBoost.API.Features.PracticeSessions.Models;

using EduBoost.API.Infrastructure;

using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Services;

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



public class PracticeSessionsRepository(
    AppDbContext db,
    ILearningStatesRepository learningStates,
    IRoadmapRepository roadmap,
    IAgentService? agentService = null,
    ILogger<PracticeSessionsRepository>? logger = null,
    IConfiguration? configuration = null) : IPracticeSessionsRepository

{

    private static readonly TimeSpan SessionTtl = TimeSpan.FromHours(2);
    private readonly bool _agentDecisionEnabled = configuration?.GetValue("Features:AgentDecisionEnabled", true) ?? true;
    private readonly bool _irtAdaptiveSelectionEnabled = configuration?.GetValue("Features:IrtAdaptiveSelectionEnabled", true) ?? true;
    private readonly double _selfPracticeMasteryThreshold = configuration?.GetValue("Features:SelfPracticeMasteryThreshold", 0.95) ?? 0.95;
    private readonly IAgentService? _agentService = agentService;
    private readonly ILogger<PracticeSessionsRepository>? _logger = logger;



    public Task<StartPracticeResponse> StartSessionAsync(Guid userId, StartPracticeRequest request)

        => StartSessionInternalAsync(userId, request);



    private async Task<StartPracticeResponse> StartSessionInternalAsync(Guid userId, StartPracticeRequest request)

    {

        List<Question> questions;

        if (string.Equals(request.Mode, "fixed", StringComparison.OrdinalIgnoreCase))

        {

            if (request.QuestionIds is not { Count: > 0 })

                throw new InvalidOperationException("Fixed mode requires questionIds");



            var idList = request.QuestionIds;

            var idSet = idList.ToHashSet();

            var loaded = await db.Questions

                .Include(q => q.Options)

                .Include(q => q.Quiz)

                .Where(q => idSet.Contains(q.Id))

                .ToListAsync();



            questions = idList

                .Select(id => loaded.FirstOrDefault(q => q.Id == id))

                .Where(q => q != null)

                .Cast<Question>()

                .ToList();



            if (questions.Count != idList.Count)

                throw new InvalidOperationException("Một hoặc nhiều câu hỏi không tồn tại");

        }

        else if (request.QuizId.HasValue && request.QuizId.Value != Guid.Empty

            && (string.Equals(request.Mode, "test", StringComparison.OrdinalIgnoreCase)

                || string.Equals(request.Mode, "practice", StringComparison.OrdinalIgnoreCase)))

        {

            questions = await db.Questions

                .Include(q => q.Options)

                .Include(q => q.Quiz)

                .Where(q => q.QuizId == request.QuizId.Value)

                .OrderBy(q => q.OrderIndex)

                .ToListAsync();



            if (questions.Count == 0)

                throw new InvalidOperationException("Quiz không có câu hỏi");

        }

        else if (string.Equals(request.Mode, "self_practice", StringComparison.OrdinalIgnoreCase))

        {

            if (!request.ClassId.HasValue || request.ClassId.Value == Guid.Empty)

                throw new InvalidOperationException("ClassId is required for self_practice mode");

            if (!request.TopicId.HasValue || request.TopicId.Value == Guid.Empty)

                throw new InvalidOperationException("TopicId is required for self_practice mode");

            var topicId = request.TopicId.Value;

            var classId = request.ClassId.Value;

            var bktState = await db.BktStates

                .FirstOrDefaultAsync(b => b.UserId == userId && b.TopicId == topicId);

            var theta = bktState?.IrtTheta ?? 0.0;

            questions = await db.Questions

                .Include(q => q.Options)

                .Include(q => q.Quiz)

                .Where(q => q.Quiz.ClassId == classId

                    && q.Quiz.IsPublished

                    && (q.Quiz.TopicId == topicId || q.SourceTopicId == topicId))

                .OrderBy(q => Math.Abs(q.DifficultyIndex - theta))

                .Take(request.QuestionCount)

                .ToListAsync();

        }

        else

        {

            if (!request.TopicId.HasValue || request.TopicId.Value == Guid.Empty)

                throw new InvalidOperationException("TopicId is required");



            var topicId = request.TopicId.Value;

            var bktState = await db.BktStates

                .FirstOrDefaultAsync(b => b.UserId == userId && b.TopicId == topicId);



            string targetDifficulty = "medium";

            if (bktState != null)

            {

                if (bktState.MasteryProbability < 0.3) targetDifficulty = "easy";

                else if (bktState.MasteryProbability > 0.7) targetDifficulty = "hard";

            }



            questions = await db.Questions

                .Include(q => q.Options)

                .Where(q => q.Quiz.TopicId == topicId)

                .OrderBy(q => Math.Abs(q.DifficultyIndex - (bktState != null ? bktState.IrtTheta : 0.0)))

                .ThenBy(q => q.Difficulty == targetDifficulty ? 0 : 1)

                .Take(request.QuestionCount)

                .ToListAsync();

        }



        if (questions.Count == 0)

            throw new InvalidOperationException("Không có câu hỏi cho chủ đề này");



        var sessionTopicId = await ResolveSessionTopicIdAsync(request, questions);

        var topic = await db.Topics.FindAsync(sessionTopicId);

        var topicName = topic?.Name

            ?? (request.QuizId.HasValue

                ? await db.Quizzes.Where(q => q.Id == request.QuizId.Value).Select(q => q.Title).FirstOrDefaultAsync()

                : null)

            ?? throw new InvalidOperationException("Topic not found");



        var bktStateForSession = await db.BktStates

            .FirstOrDefaultAsync(b => b.UserId == userId && b.TopicId == sessionTopicId);



        var affectedTopicIds = questions

            .Select(ResolveQuestionTopicId)

            .Where(id => id.HasValue)

            .Select(id => id!.Value)

            .Distinct()

            .ToList();



        var sessionId = Guid.NewGuid();

        var state = new PracticeSessionState

        {

            UserId = userId,

            TopicId = sessionTopicId,

            TopicName = topicName,

            Mode = request.Mode,

            QuizId = request.QuizId,

            ClassId = request.ClassId,

            Questions = questions.Select(q => q.Id).ToList(),

            AffectedTopicIds = affectedTopicIds,

            CurrentIndex = 0,

            CorrectCount = 0,

            StartTime = DateTime.UtcNow,

            MasteryBefore = bktStateForSession?.MasteryProbability ?? 0.3,

            DbMasteryBaseline = bktStateForSession?.MasteryProbability ?? 0.3,

            DbThetaBaseline = bktStateForSession?.IrtTheta ?? 0.0,

            SessionMastery = bktStateForSession?.MasteryProbability ?? 0.3,

            SessionTheta = bktStateForSession?.IrtTheta ?? 0.0,

            Answers = []

        };



        db.PracticeActiveSessions.Add(new PracticeActiveSession

        {

            Id = sessionId,

            UserId = userId,

            StateJson = JsonSerializer.Serialize(state),

            CreatedAt = DateTime.UtcNow,

            ExpiresAt = DateTime.UtcNow.Add(SessionTtl)

        });

        await db.SaveChangesAsync();



        return new StartPracticeResponse

        {

            SessionId = sessionId.ToString(),

            TopicName = topicName,

            Question = MapQuestionDto(questions[0]),

            QuestionNumber = 1,

            TotalQuestions = questions.Count

        };

    }



    public async Task<SubmitAnswerResponse> SubmitAnswerAsync(Guid userId, SubmitAnswerRequest request)

    {

        var session = await LoadSessionAsync(userId, request.SessionId);

        var state = DeserializeState(session);



        var questionId = Guid.Parse(request.QuestionId);

        var question = await db.Questions

            .Include(q => q.Options)

            .Include(q => q.Quiz)

            .FirstOrDefaultAsync(q => q.Id == questionId)

            ?? throw new InvalidOperationException("Question not found");



        var selectedOptionId = request.SelectedOptionId

            ?? request.SelectedOptionIds?.FirstOrDefault();



        bool isCorrect;

        string? correctAnswer;

        if (question.Type == "fill_blank")

        {

            isCorrect = string.Equals(question.CorrectAnswer?.Trim(), request.TextAnswer?.Trim(), StringComparison.OrdinalIgnoreCase);

            correctAnswer = question.CorrectAnswer;

        }

        else

        {

            var correctOption = question.Options.FirstOrDefault(o => o.IsCorrect);

            isCorrect = correctOption != null && correctOption.Id.ToString() == selectedOptionId;

            correctAnswer = correctOption?.Text;

        }



        if (isCorrect) state.CorrectCount++;

        state.CurrentIndex++;



        var isTestMode = string.Equals(state.Mode, "test", StringComparison.OrdinalIgnoreCase);

        var isSelfPractice = string.Equals(state.Mode, "self_practice", StringComparison.OrdinalIgnoreCase);



        state.Answers.Add(new PracticeAnswerState

        {

            QuestionId = questionId,

            SelectedOptionId = selectedOptionId,

            TextAnswer = request.TextAnswer,

            IsCorrect = isCorrect

        });



        UpdateBktResponse? updateResult = null;

        double masteryForDecision;

        double thetaForDecision;

        double? thetaBefore = null;

        double? thetaAfter = null;

        double? questionBeta = null;

        var topicIdForAnswer = ResolveQuestionTopicId(question) ?? state.TopicId;

        var beta = DifficultyIndex.Clamp(question.DifficultyIndex);



        if (isSelfPractice)

        {

            thetaBefore = state.SessionTheta;

            var bktResult = BktIrtCalculator.ApplyUpdate(

                state.SessionMastery, 0.25, 0.1, 0.1,

                state.SessionTheta, beta, isCorrect);

            state.SessionMastery = bktResult.Mastery;

            state.SessionTheta = bktResult.Theta;

            thetaAfter = bktResult.Theta;

            questionBeta = bktResult.Beta;

            masteryForDecision = state.SessionMastery;

            thetaForDecision = state.SessionTheta;

        }

        else

        {

            updateResult = await learningStates.UpdateAfterAnswerAsync(userId, new UpdateBktRequest

            {

                TopicId = topicIdForAnswer,

                QuestionId = questionId,

                IsCorrect = isCorrect,

                ResponseTime = isTestMode ? null : request.ResponseTimeSeconds,

                QuestionDifficultyIndex = question.DifficultyIndex

            });

            masteryForDecision = updateResult.State.MasteryProbability;

            thetaForDecision = updateResult.State.IrtTheta;

            thetaBefore = updateResult.ThetaBefore;

            thetaAfter = updateResult.ThetaAfter;

            questionBeta = updateResult.QuestionBeta;

        }



        bool isComplete = state.CurrentIndex >= state.Questions.Count;

        PracticeQuestionDto? nextQuestion = null;
        string? agentAction = null;
        string? agentReason = null;
        string? agentExplanation = null;
        bool recommendNextSkill = false;
        string? nextSkillSuggestion = null;
        double? targetBeta = null;
        string? suggestedNextTopicId = null;
        string? suggestedNextTopicName = null;



        if (!isComplete)

        {
            if (_irtAdaptiveSelectionEnabled
                && !isTestMode
                && (updateResult != null || isSelfPractice)
                && (string.Equals(state.Mode, "standard", StringComparison.OrdinalIgnoreCase)
                    || isSelfPractice))
            {
                var reorderTheta = isSelfPractice ? state.SessionTheta : updateResult!.ThetaAfter;
                await ReorderRemainingQuestionsByThetaAsync(state, reorderTheta);
            }

            var nextQ = await db.Questions

                .Include(q => q.Options)

                .FirstOrDefaultAsync(q => q.Id == state.Questions[state.CurrentIndex]);

            if (nextQ != null) nextQuestion = MapQuestionDto(nextQ);

            else isComplete = true;

        }

        if (!isTestMode && (updateResult != null || isSelfPractice))
        {
            var decision = await ResolveAgentDecisionAsync(
                userId,
                state,
                masteryForDecision,
                thetaForDecision
            );

            agentAction = decision.Action;
            agentReason = decision.Reason;
            agentExplanation = decision.Explanation;
            recommendNextSkill = decision.RecommendNextSkill;
            nextSkillSuggestion = decision.NextSkillSuggestion;
            targetBeta = decision.TargetBeta;
            suggestedNextTopicId = decision.SuggestedNextTopicId;
            suggestedNextTopicName = decision.SuggestedNextTopicName;

            _logger?.LogInformation(
                "Practice decision user={UserId} topic={TopicId} action={Action} mastery={Mastery:F3} theta_before={ThetaBefore:F3} theta_after={ThetaAfter:F3} beta={Beta:F3}",
                userId,
                state.TopicId,
                agentAction ?? "N/A",
                masteryForDecision,
                thetaBefore,
                thetaAfter,
                questionBeta
            );
        }



        await SaveSessionStateAsync(session, state);



        if (isTestMode)

        {

            return new SubmitAnswerResponse

            {

                FeedbackSuppressed = true,

                NextQuestion = nextQuestion,

                QuestionNumber = isComplete ? state.CurrentIndex : state.CurrentIndex + 1,

                TotalQuestions = state.Questions.Count,

                IsSessionComplete = isComplete

            };

        }



        return new SubmitAnswerResponse

        {

            IsCorrect = isCorrect,

            CorrectAnswer = correctAnswer,

            Explanation = question.Explanation,

            NextQuestion = nextQuestion,

            QuestionNumber = state.CurrentIndex + 1,

            TotalQuestions = state.Questions.Count,

            IsSessionComplete = isComplete,

            AgentAction = agentAction,

            AgentReason = agentReason,

            AgentExplanation = agentExplanation,

            RecommendNextSkill = recommendNextSkill,

            NextSkillSuggestion = nextSkillSuggestion,

            ThetaBefore = thetaBefore,

            ThetaAfter = thetaAfter,

            QuestionBeta = questionBeta,

            TargetBeta = targetBeta,

            SessionMastery = isSelfPractice ? state.SessionMastery : null,

            DbMasteryBaseline = isSelfPractice ? state.DbMasteryBaseline : null,

            SuggestedNextTopicId = suggestedNextTopicId,

            SuggestedNextTopicName = suggestedNextTopicName

        };

    }



    public async Task<PracticeSessionSummary> EndSessionAsync(Guid userId, string sessionId)

    {

        var session = await LoadSessionAsync(userId, sessionId);

        var state = DeserializeState(session);

        db.PracticeActiveSessions.Remove(session);



        var score = state.CurrentIndex > 0 ? (double)state.CorrectCount / state.CurrentIndex * 100 : 0;

        var isSelfPractice = string.Equals(state.Mode, "self_practice", StringComparison.OrdinalIgnoreCase);

        var bktAfter = await db.BktStates

            .FirstOrDefaultAsync(b => b.UserId == userId && b.TopicId == state.TopicId);

        var masteryAfter = isSelfPractice
            ? state.SessionMastery
            : bktAfter?.MasteryProbability ?? state.MasteryBefore;

        if (state.QuizId.HasValue && state.CurrentIndex > 0)
        {
            var grade = score >= 90 ? "Xuất sắc" : score >= 70 ? "Tốt" : score >= 50 ? "Trung bình" : "Cần cải thiện";
            db.QuizSubmissions.Add(new QuizSubmission
            {
                Id = Guid.NewGuid(),
                StudentId = userId,
                QuizId = state.QuizId.Value,
                Score = state.CorrectCount,
                TotalQuestions = state.CurrentIndex,
                Percentage = score,
                Grade = grade,
                AnswersJson = JsonSerializer.Serialize(state.Answers),
                CompletedAt = DateTime.UtcNow
            });
        }



        db.LearningSessions.Add(new LearningSession

        {

            UserId = userId,

            TopicId = state.TopicId,

            StartTime = state.StartTime,

            EndTime = DateTime.UtcNow,

            QuestionsAttempted = state.CurrentIndex,

            CorrectAnswers = state.CorrectCount,

            Score = score

        });



        var profile = await db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile != null)

        {

            var today = DateTime.UtcNow.Date;

            if (profile.LastActiveDate?.Date == today.AddDays(-1))

                profile.LearningStreak++;

            else if (profile.LastActiveDate?.Date != today)

                profile.LearningStreak = 1;



            profile.LastActiveDate = DateTime.UtcNow;

            profile.UpdatedAt = DateTime.UtcNow;

        }



        await db.SaveChangesAsync();



        IEnumerable<Guid> topicsToSync = isSelfPractice
            ? []
            : state.AffectedTopicIds is { Count: > 0 }
                ? state.AffectedTopicIds
                : [state.TopicId];



        foreach (var topicId in topicsToSync.Distinct())

        {

            var syncTopic = await db.Topics.FindAsync(topicId);

            if (syncTopic?.ClassId is Guid classId)

                await roadmap.SyncAfterLearningAsync(classId, userId, topicId);

        }



        string? recommendation = null;

        if (score >= 80) recommendation = "Xuất sắc! Bạn có thể chuyển sang chủ đề khó hơn.";

        else if (score < 50) recommendation = "Hãy ôn tập lại chủ đề này trước khi tiếp tục.";



        List<QuizReviewItemDto>? reviewItems = null;

        if (string.Equals(state.Mode, "test", StringComparison.OrdinalIgnoreCase) && state.Answers.Count > 0)

        {

            var answerQuestionIds = state.Answers.Select(a => a.QuestionId).ToList();

            var reviewQuestions = await db.Questions

                .Include(q => q.Options)

                .Where(q => answerQuestionIds.Contains(q.Id))

                .ToListAsync();



            reviewItems = state.Answers.Select(a =>

            {

                var q = reviewQuestions.First(rq => rq.Id == a.QuestionId);

                var correctOpt = q.Options.FirstOrDefault(o => o.IsCorrect);

                return new QuizReviewItemDto

                {

                    QuestionId = q.Id.ToString(),

                    Text = q.Text,

                    Type = q.Type,

                    Options = q.Options.OrderBy(o => o.OrderIndex).Select(o => new PracticeOptionDto

                    {

                        Id = o.Id.ToString(),

                        Text = o.Text

                    }).ToList(),

                    SelectedOptionId = a.SelectedOptionId,

                    CorrectOptionId = correctOpt?.Id.ToString(),

                    CorrectAnswer = correctOpt?.Text ?? q.CorrectAnswer,

                    IsCorrect = a.IsCorrect,

                    Explanation = q.Explanation

                };

            }).ToList();

        }



        return new PracticeSessionSummary

        {

            SessionId = sessionId,

            TopicName = state.TopicName,

            QuestionsAttempted = state.CurrentIndex,

            CorrectAnswers = state.CorrectCount,

            Score = score,

            MasteryChange = masteryAfter - state.MasteryBefore,

            Recommendation = recommendation,

            ItemsReviewed = 0,

            NextReviewSummary = null,

            ReviewItems = reviewItems

        };

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
            .Select(q => new { q.Id, q.DifficultyIndex })
            .ToListAsync();

        var ordered = remainingQuestions
            .OrderBy(q => Math.Abs(q.DifficultyIndex - theta))
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
                    "NEXT_SKILL",
                    $"Bạn đã đạt mức thành thạo {mastery:P0} cho chủ đề này trong phiên luyện tập.",
                    null,
                    true,
                    $"Đề xuất chuyển sang chủ đề: {nextTopic.Name}",
                    DifficultyIndex.Clamp(theta),
                    nextTopic.Id.ToString(),
                    nextTopic.Name
                );
            }
        }

        var fallbackAction = mastery < 0.5 ? "EXPLAIN" : mastery < 0.95 ? "QUIZ" : "NEXT_SKILL";
        var fallbackReason = $"Fallback decision from mastery={mastery:F2}";
        var fallbackTargetBeta = DifficultyIndex.Clamp(theta);

        if (!_agentDecisionEnabled || _agentService == null)
            return (fallbackAction, fallbackReason, null, fallbackAction == "NEXT_SKILL", null, fallbackTargetBeta, null, null);

        var response = await _agentService.GetNextActionAsync(userId.ToString(), state.TopicName, mastery, theta);
        var action = response?.Action?.Trim().ToUpperInvariant();
        if (action is not ("EXPLAIN" or "QUIZ" or "NEXT_SKILL"))
        {
            _logger?.LogWarning("Invalid agent action '{Action}' for topic {Topic}; using fallback", response?.Action, state.TopicName);
            action = fallbackAction;
        }

        var reason = string.IsNullOrWhiteSpace(response?.Reason) ? fallbackReason : response!.Reason;
        var targetBeta = fallbackTargetBeta;
        if (response?.Params != null &&
            response.Params.TryGetValue("beta", out var betaObj) &&
            double.TryParse(Convert.ToString(betaObj), out var parsedBeta))
        {
            targetBeta = DifficultyIndex.Clamp(parsedBeta);
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



    private async Task<PracticeActiveSession> LoadSessionAsync(Guid userId, string sessionId)

    {

        if (!Guid.TryParse(sessionId, out var id))

            throw new InvalidOperationException("Session not found");



        var session = await db.PracticeActiveSessions

            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId && s.ExpiresAt > DateTime.UtcNow);



        return session ?? throw new InvalidOperationException("Session not found");

    }



    private static PracticeSessionState DeserializeState(PracticeActiveSession session) =>

        JsonSerializer.Deserialize<PracticeSessionState>(session.StateJson)

        ?? throw new InvalidOperationException("Invalid session state");



    private async Task SaveSessionStateAsync(PracticeActiveSession session, PracticeSessionState state)

    {

        session.StateJson = JsonSerializer.Serialize(state);

        session.ExpiresAt = DateTime.UtcNow.Add(SessionTtl);

        await db.SaveChangesAsync();

    }



    private static PracticeQuestionDto MapQuestionDto(Question q) => new()

    {

        QuestionId = q.Id.ToString(),

        Text = q.Text,

        Type = q.Type,

        Difficulty = q.Difficulty,

        DifficultyIndex = q.DifficultyIndex,

        Options = q.Options.OrderBy(o => o.OrderIndex).Select(o => new PracticeOptionDto

        {

            Id = o.Id.ToString(),

            Text = o.Text

        }).ToList()

    };



    private class PracticeSessionState

    {

        public Guid UserId { get; set; }

        public Guid TopicId { get; set; }

        public string TopicName { get; set; } = "";

        public string Mode { get; set; } = "standard";

        public Guid? QuizId { get; set; }

        public Guid? ClassId { get; set; }

        public List<Guid> Questions { get; set; } = [];

        public List<Guid> AffectedTopicIds { get; set; } = [];

        public int CurrentIndex { get; set; }

        public int CorrectCount { get; set; }

        public DateTime StartTime { get; set; }

        public double MasteryBefore { get; set; }

        public double DbMasteryBaseline { get; set; }

        public double DbThetaBaseline { get; set; }

        public double SessionMastery { get; set; }

        public double SessionTheta { get; set; }

        public List<PracticeAnswerState> Answers { get; set; } = [];

    }



    private class PracticeAnswerState

    {

        public Guid QuestionId { get; set; }

        public string? SelectedOptionId { get; set; }

        public string? TextAnswer { get; set; }

        public bool IsCorrect { get; set; }

    }

}


