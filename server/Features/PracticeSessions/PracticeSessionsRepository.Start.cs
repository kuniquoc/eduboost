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

public partial class PracticeSessionsRepository
{
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

            ExpiresAt = _sessionStore.NewExpiry()

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



}
