using System.Collections.Concurrent;
using EduBoost.API.Features.LearningStates;
using EduBoost.API.Features.LearningStates.Models;
using EduBoost.API.Features.PracticeSessions.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.PracticeSessions;

public interface IPracticeSessionsRepository
{
    Task<StartPracticeResponse> StartSessionAsync(Guid userId, StartPracticeRequest request);
    Task<SubmitAnswerResponse> SubmitAnswerAsync(Guid userId, SubmitAnswerRequest request);
    Task<PracticeSessionSummary> EndSessionAsync(Guid userId, string sessionId);
}

public class PracticeSessionsRepository(AppDbContext db, ILearningStatesRepository learningStates) : IPracticeSessionsRepository
{
    private static readonly ConcurrentDictionary<string, PracticeState> _sessions = new();

    public async Task<StartPracticeResponse> StartSessionAsync(Guid userId, StartPracticeRequest request)
    {
        var topic = await db.Topics.FindAsync(request.TopicId)
            ?? throw new InvalidOperationException("Topic not found");

        // Get BKT state to determine appropriate difficulty
        var bktState = await db.BktStates
            .FirstOrDefaultAsync(b => b.UserId == userId && b.TopicId == request.TopicId);

        string targetDifficulty = "medium";
        if (bktState != null)
        {
            if (bktState.MasteryProbability < 0.3) targetDifficulty = "easy";
            else if (bktState.MasteryProbability > 0.7) targetDifficulty = "hard";
        }

        // Get questions: weighted sampling (prefer target difficulty, include some variety)
        var questions = await db.Questions
            .Include(q => q.Options)
            .Where(q => q.Quiz.TopicId == request.TopicId)
            .OrderBy(q => q.Difficulty == targetDifficulty ? 0 : 1)
            .ThenBy(q => Guid.NewGuid())
            .Take(request.QuestionCount)
            .ToListAsync();

        if (questions.Count == 0)
            throw new InvalidOperationException("Không có câu hỏi cho chủ đề này");

        var sessionId = Guid.NewGuid().ToString();
        var state = new PracticeState
        {
            UserId = userId,
            TopicId = request.TopicId,
            TopicName = topic.Name,
            Questions = questions.Select(q => q.Id).ToList(),
            CurrentIndex = 0,
            CorrectCount = 0,
            StartTime = DateTime.UtcNow
        };
        _sessions[sessionId] = state;

        return new StartPracticeResponse
        {
            SessionId = sessionId,
            TopicName = topic.Name,
            Question = MapQuestionDto(questions[0]),
            QuestionNumber = 1,
            TotalQuestions = questions.Count
        };
    }

    public async Task<SubmitAnswerResponse> SubmitAnswerAsync(Guid userId, SubmitAnswerRequest request)
    {
        if (!_sessions.TryGetValue(request.SessionId, out var state))
            throw new InvalidOperationException("Session not found");

        var questionId = Guid.Parse(request.QuestionId);
        var question = await db.Questions
            .Include(q => q.Options)
            .FirstOrDefaultAsync(q => q.Id == questionId)
            ?? throw new InvalidOperationException("Question not found");

        // Check answer
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
            isCorrect = correctOption != null && correctOption.Id.ToString() == request.SelectedOptionId;
            correctAnswer = correctOption?.Text;
        }

        if (isCorrect) state.CorrectCount++;
        state.CurrentIndex++;

        // Update BKT state
        await learningStates.UpdateAfterAnswerAsync(userId, new UpdateBktRequest
        {
            TopicId = state.TopicId,
            QuestionId = questionId,
            IsCorrect = isCorrect
        });

        // Get next question
        bool isComplete = state.CurrentIndex >= state.Questions.Count;
        PracticeQuestionDto? nextQuestion = null;

        if (!isComplete)
        {
            var nextQ = await db.Questions
                .Include(q => q.Options)
                .FirstOrDefaultAsync(q => q.Id == state.Questions[state.CurrentIndex]);
            if (nextQ != null) nextQuestion = MapQuestionDto(nextQ);
            else isComplete = true;
        }

        return new SubmitAnswerResponse
        {
            IsCorrect = isCorrect,
            CorrectAnswer = correctAnswer,
            Explanation = question.Explanation,
            NextQuestion = nextQuestion,
            QuestionNumber = state.CurrentIndex + 1,
            IsSessionComplete = isComplete
        };
    }

    public async Task<PracticeSessionSummary> EndSessionAsync(Guid userId, string sessionId)
    {
        if (!_sessions.TryRemove(sessionId, out var state))
            throw new InvalidOperationException("Session not found");

        var score = state.CurrentIndex > 0 ? (double)state.CorrectCount / state.CurrentIndex * 100 : 0;

        // Persist learning session
        var session = new LearningSession
        {
            UserId = userId,
            TopicId = state.TopicId,
            StartTime = state.StartTime,
            EndTime = DateTime.UtcNow,
            QuestionsAttempted = state.CurrentIndex,
            CorrectAnswers = state.CorrectCount,
            Score = score
        };
        db.LearningSessions.Add(session);

        // Update user profile activity
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

        string? recommendation = null;
        if (score >= 80) recommendation = "Xuất sắc! Bạn có thể chuyển sang chủ đề khó hơn.";
        else if (score < 50) recommendation = "Hãy ôn tập lại chủ đề này trước khi tiếp tục.";

        return new PracticeSessionSummary
        {
            SessionId = sessionId,
            TopicName = state.TopicName,
            QuestionsAttempted = state.CurrentIndex,
            CorrectAnswers = state.CorrectCount,
            Score = score,
            Recommendation = recommendation
        };
    }

    private static PracticeQuestionDto MapQuestionDto(Question q) => new()
    {
        QuestionId = q.Id.ToString(),
        Text = q.Text,
        Type = q.Type,
        Difficulty = q.Difficulty,
        Options = q.Options.OrderBy(o => o.OrderIndex).Select(o => new PracticeOptionDto
        {
            Id = o.Id.ToString(),
            Text = o.Text
        }).ToList()
    };

    private class PracticeState
    {
        public Guid UserId { get; set; }
        public Guid TopicId { get; set; }
        public string TopicName { get; set; } = "";
        public List<Guid> Questions { get; set; } = [];
        public int CurrentIndex { get; set; }
        public int CorrectCount { get; set; }
        public DateTime StartTime { get; set; }
    }
}
