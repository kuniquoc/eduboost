using System.Text.Json;
using EduBoost.API.Features.PlacementTests.Models;
using EduBoost.API.Features.Roadmap;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.PlacementTests;

public interface IPlacementTestsRepository
{
    Task<StartPlacementTestResponse> StartTestAsync(Guid userId, Guid? classId);
    Task<AnswerPlacementResponse> SubmitAnswerAsync(Guid userId, AnswerPlacementRequest request);
    Task<CompletePlacementResponse> CompleteTestAsync(Guid userId, string sessionId);
    Task<PlacementTestResultDto?> GetResultAsync(Guid userId, Guid? classId = null);
}

public class PlacementTestsRepository(AppDbContext db, IRoadmapRepository roadmap) : IPlacementTestsRepository
{
    private const int MinQuestions = 10;
    private const int MaxQuestions = 20;
    private static readonly TimeSpan SessionTtl = TimeSpan.FromHours(2);

    public async Task<StartPlacementTestResponse> StartTestAsync(Guid userId, Guid? classId)
    {
        if (classId.HasValue)
        {
            var enrolled = await db.Enrollments.AnyAsync(e => e.StudentId == userId && e.ClassId == classId.Value);
            if (!enrolled)
                throw new InvalidOperationException("Bạn chưa tham gia lớp học này");
        }

        await ExpireStaleSessionsAsync(userId);

        var questions = await LoadQuestionPoolAsync(classId);
        if (questions.Count == 0)
        {
            return new StartPlacementTestResponse
            {
                SessionId = Guid.Empty.ToString(),
                Question = new PlacementQuestionDto { Text = "Không có câu hỏi nào cho bài kiểm tra" },
                QuestionNumber = 0,
                TotalQuestions = 0
            };
        }

        var sessionId = Guid.NewGuid();
        var state = new PlacementSessionState
        {
            UserId = userId,
            ClassId = classId,
            QuestionPool = questions.Select(q => q.Id).ToList(),
            CurrentDifficulty = "medium",
            CurrentIndex = 0,
            Answers = []
        };

        db.PlacementTestSessions.Add(new PlacementTestSession
        {
            Id = sessionId,
            UserId = userId,
            ClassId = classId,
            StateJson = JsonSerializer.Serialize(state),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.Add(SessionTtl)
        });
        await db.SaveChangesAsync();

        var firstQuestion = questions[0];
        return new StartPlacementTestResponse
        {
            SessionId = sessionId.ToString(),
            Question = MapQuestionToDto(firstQuestion),
            QuestionNumber = 1,
            TotalQuestions = Math.Min(questions.Count, MaxQuestions)
        };
    }

    public async Task<AnswerPlacementResponse> SubmitAnswerAsync(Guid userId, AnswerPlacementRequest request)
    {
        var session = await LoadSessionAsync(userId, request.SessionId);
        var state = DeserializeState(session);

        var questionId = Guid.Parse(request.QuestionId);
        var question = await db.Questions
            .Include(q => q.Options)
            .Include(q => q.Quiz).ThenInclude(q => q!.Topic)
            .FirstOrDefaultAsync(q => q.Id == questionId)
            ?? throw new InvalidOperationException("Question not found");

        var selectedOptionId = request.SelectedOptionId
            ?? request.SelectedOptionIds?.FirstOrDefault();

        bool isCorrect;
        if (question.Type == "fill_blank")
        {
            isCorrect = string.Equals(question.CorrectAnswer?.Trim(), request.TextAnswer?.Trim(), StringComparison.OrdinalIgnoreCase);
        }
        else
        {
            var correctOption = question.Options.FirstOrDefault(o => o.IsCorrect);
            isCorrect = correctOption != null && correctOption.Id.ToString() == selectedOptionId;
        }

        state.Answers.Add(new PlacementAnswerState
        {
            QuestionId = questionId,
            IsCorrect = isCorrect,
            Difficulty = question.Difficulty,
            TopicId = question.Quiz?.TopicId
        });
        state.CurrentIndex++;

        var recentAnswers = state.Answers.TakeLast(3).ToList();
        var recentCorrect = recentAnswers.Count(a => a.IsCorrect);
        if (recentCorrect >= 2)
            state.CurrentDifficulty = state.CurrentDifficulty == "easy" ? "medium" : "hard";
        else if (recentCorrect == 0)
            state.CurrentDifficulty = state.CurrentDifficulty == "hard" ? "medium" : "easy";

        bool isComplete = state.CurrentIndex >= MaxQuestions ||
            (state.CurrentIndex >= MinQuestions && IsLevelStable(state));

        if (isComplete)
        {
            await SaveSessionStateAsync(session, state);
            return new AnswerPlacementResponse
            {
                IsCorrect = isCorrect,
                IsComplete = true,
                NextQuestion = null,
                QuestionNumber = state.CurrentIndex,
                TotalQuestions = state.CurrentIndex
            };
        }

        var answeredIds = state.Answers.Select(a => a.QuestionId).ToHashSet();
        var nextQuestion = await GetNextQuestionAsync(state, answeredIds, state.ClassId);

        if (nextQuestion == null)
        {
            await SaveSessionStateAsync(session, state);
            return new AnswerPlacementResponse
            {
                IsCorrect = isCorrect,
                IsComplete = true,
                NextQuestion = null,
                QuestionNumber = state.CurrentIndex,
                TotalQuestions = state.CurrentIndex
            };
        }

        await SaveSessionStateAsync(session, state);
        return new AnswerPlacementResponse
        {
            IsCorrect = isCorrect,
            IsComplete = false,
            NextQuestion = MapQuestionToDto(nextQuestion),
            QuestionNumber = state.CurrentIndex + 1,
            TotalQuestions = MaxQuestions
        };
    }

    public async Task<CompletePlacementResponse> CompleteTestAsync(Guid userId, string sessionId)
    {
        var session = await LoadSessionAsync(userId, sessionId);
        var state = DeserializeState(session);

        db.PlacementTestSessions.Remove(session);

        var totalCorrect = state.Answers.Count(a => a.IsCorrect);
        var totalQuestions = state.Answers.Count;
        var finalScore = totalQuestions > 0 ? (double)totalCorrect / totalQuestions * 100 : 0;

        var hardCorrect = state.Answers.Where(a => a.Difficulty == "hard").Select(a => a.IsCorrect ? 1.0 : 0.0).DefaultIfEmpty(0).Average();
        var mediumCorrect = state.Answers.Where(a => a.Difficulty == "medium").Select(a => a.IsCorrect ? 1.0 : 0.0).DefaultIfEmpty(0).Average();

        string level = hardCorrect >= 0.7 ? "advanced" : mediumCorrect >= 0.6 ? "intermediate" : "beginner";

        var topicScores = state.Answers
            .Where(a => a.TopicId != null)
            .GroupBy(a => a.TopicId!.Value)
            .Select(g => new { TopicId = g.Key, Score = g.Average(a => a.IsCorrect ? 1.0 : 0.0) })
            .ToList();

        var topicNames = await db.Topics
            .Where(t => topicScores.Select(ts => ts.TopicId).Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Name);

        var strengths = topicScores.Where(ts => ts.Score >= 0.7).Select(ts => new TopicStrengthDto
        {
            TopicId = ts.TopicId.ToString(),
            TopicName = topicNames.GetValueOrDefault(ts.TopicId, ""),
            Score = ts.Score
        }).ToList();

        var weaknesses = topicScores.Where(ts => ts.Score < 0.5).Select(ts => new TopicStrengthDto
        {
            TopicId = ts.TopicId.ToString(),
            TopicName = topicNames.GetValueOrDefault(ts.TopicId, ""),
            Score = ts.Score
        }).ToList();

        var result = new PlacementTestResult
        {
            UserId = userId,
            ClassId = state.ClassId,
            InitialLevel = level,
            FinalScore = finalScore,
            StrengthsJson = JsonSerializer.Serialize(strengths),
            WeaknessesJson = JsonSerializer.Serialize(weaknesses)
        };
        db.PlacementTestResults.Add(result);

        foreach (var ts in topicScores)
        {
            var existing = await db.BktStates.FirstOrDefaultAsync(b => b.UserId == userId && b.TopicId == ts.TopicId);
            if (existing == null)
            {
                db.BktStates.Add(new BktState
                {
                    UserId = userId,
                    TopicId = ts.TopicId,
                    MasteryProbability = ts.Score * 0.5,
                });
            }
        }

        var profile = await db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null)
        {
            profile = new UserProfile { UserId = userId, CurrentLevel = level };
            db.UserProfiles.Add(profile);
        }
        else
        {
            profile.CurrentLevel = level;
            profile.UpdatedAt = DateTime.UtcNow;
        }

        if (state.ClassId.HasValue)
        {
            var enrollment = await db.Enrollments
                .FirstOrDefaultAsync(e => e.StudentId == userId && e.ClassId == state.ClassId.Value);
            if (enrollment != null)
                enrollment.EntryTestCompleted = true;
        }

        await db.SaveChangesAsync();

        if (state.ClassId.HasValue)
            await roadmap.GenerateAsync(state.ClassId.Value, userId, result.Id.ToString());

        return new CompletePlacementResponse
        {
            ResultId = result.Id.ToString(),
            InitialLevel = level,
            FinalScore = finalScore,
            Strengths = strengths,
            Weaknesses = weaknesses,
            ClassId = state.ClassId?.ToString()
        };
    }

    public async Task<PlacementTestResultDto?> GetResultAsync(Guid userId, Guid? classId = null)
    {
        var query = db.PlacementTestResults.Where(r => r.UserId == userId);
        if (classId.HasValue)
            query = query.Where(r => r.ClassId == classId);

        var result = await query.OrderByDescending(r => r.CreatedAt).FirstOrDefaultAsync();
        if (result == null) return null;

        return new PlacementTestResultDto
        {
            Id = result.Id.ToString(),
            ClassId = result.ClassId?.ToString(),
            InitialLevel = result.InitialLevel,
            FinalScore = result.FinalScore,
            Strengths = string.IsNullOrEmpty(result.StrengthsJson) ? [] : JsonSerializer.Deserialize<List<TopicStrengthDto>>(result.StrengthsJson) ?? [],
            Weaknesses = string.IsNullOrEmpty(result.WeaknessesJson) ? [] : JsonSerializer.Deserialize<List<TopicStrengthDto>>(result.WeaknessesJson) ?? [],
            CreatedAt = result.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")
        };
    }

    private async Task<List<Question>> LoadQuestionPoolAsync(Guid? classId)
    {
        IQueryable<Question> query = db.Questions
            .Include(q => q.Options)
            .Include(q => q.Quiz).ThenInclude(q => q!.Topic)
            .Where(q => q.Difficulty == "medium");

        if (classId.HasValue)
        {
            query = query.Where(q =>
                q.Quiz != null &&
                (q.Quiz.ClassId == classId.Value ||
                 (q.Quiz.Topic != null && q.Quiz.Topic.ClassId == classId.Value)));
        }

        var questions = await query.OrderBy(q => Guid.NewGuid()).Take(MaxQuestions).ToListAsync();
        if (questions.Count > 0) return questions;

        query = db.Questions
            .Include(q => q.Options)
            .Include(q => q.Quiz).ThenInclude(q => q!.Topic);

        if (classId.HasValue)
        {
            query = query.Where(q =>
                q.Quiz != null &&
                (q.Quiz.ClassId == classId.Value ||
                 (q.Quiz.Topic != null && q.Quiz.Topic.ClassId == classId.Value)));
        }

        return await query.OrderBy(q => Guid.NewGuid()).Take(MaxQuestions).ToListAsync();
    }

    private async Task<Question?> GetNextQuestionAsync(PlacementSessionState state, HashSet<Guid> answeredIds, Guid? classId)
    {
        IQueryable<Question> BaseQuery() =>
            db.Questions
                .Include(q => q.Options)
                .Include(q => q.Quiz).ThenInclude(q => q!.Topic)
                .Where(q => !answeredIds.Contains(q.Id));

        if (classId.HasValue)
        {
            return await BaseQuery()
                .Where(q =>
                    q.Difficulty == state.CurrentDifficulty &&
                    q.Quiz != null &&
                    (q.Quiz.ClassId == classId.Value ||
                     (q.Quiz.Topic != null && q.Quiz.Topic.ClassId == classId.Value)))
                .OrderBy(q => Guid.NewGuid())
                .FirstOrDefaultAsync()
                ?? await BaseQuery()
                    .Where(q =>
                        q.Quiz != null &&
                        (q.Quiz.ClassId == classId.Value ||
                         (q.Quiz.Topic != null && q.Quiz.Topic.ClassId == classId.Value)))
                    .OrderBy(q => Guid.NewGuid())
                    .FirstOrDefaultAsync();
        }

        return await BaseQuery()
            .Where(q => q.Difficulty == state.CurrentDifficulty)
            .OrderBy(q => Guid.NewGuid())
            .FirstOrDefaultAsync()
            ?? await BaseQuery().OrderBy(q => Guid.NewGuid()).FirstOrDefaultAsync();
    }

    private async Task<PlacementTestSession> LoadSessionAsync(Guid userId, string sessionId)
    {
        if (!Guid.TryParse(sessionId, out var id))
            throw new InvalidOperationException("Session not found");

        var session = await db.PlacementTestSessions
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId && s.ExpiresAt > DateTime.UtcNow);

        return session ?? throw new InvalidOperationException("Session not found");
    }

    private static PlacementSessionState DeserializeState(PlacementTestSession session) =>
        JsonSerializer.Deserialize<PlacementSessionState>(session.StateJson)
        ?? throw new InvalidOperationException("Invalid session state");

    private async Task SaveSessionStateAsync(PlacementTestSession session, PlacementSessionState state)
    {
        session.StateJson = JsonSerializer.Serialize(state);
        session.ExpiresAt = DateTime.UtcNow.Add(SessionTtl);
        await db.SaveChangesAsync();
    }

    private async Task ExpireStaleSessionsAsync(Guid userId)
    {
        var stale = await db.PlacementTestSessions
            .Where(s => s.UserId == userId && s.ExpiresAt <= DateTime.UtcNow)
            .ToListAsync();
        if (stale.Count > 0)
        {
            db.PlacementTestSessions.RemoveRange(stale);
            await db.SaveChangesAsync();
        }
    }

    private static bool IsLevelStable(PlacementSessionState session)
    {
        if (session.Answers.Count < 5) return false;
        var last5 = session.Answers.TakeLast(5).ToList();
        var correctRate = last5.Count(a => a.IsCorrect) / 5.0;
        return correctRate >= 0.8 || correctRate <= 0.2;
    }

    private static PlacementQuestionDto MapQuestionToDto(Question q) => new()
    {
        QuestionId = q.Id.ToString(),
        Text = q.Text,
        Type = q.Type,
        Difficulty = q.Difficulty,
        Options = q.Options.OrderBy(o => o.OrderIndex).Select(o => new PlacementOptionDto
        {
            Id = o.Id.ToString(),
            Text = o.Text
        }).ToList()
    };

    private class PlacementSessionState
    {
        public Guid UserId { get; set; }
        public Guid? ClassId { get; set; }
        public List<Guid> QuestionPool { get; set; } = [];
        public string CurrentDifficulty { get; set; } = "medium";
        public int CurrentIndex { get; set; }
        public List<PlacementAnswerState> Answers { get; set; } = [];
    }

    private class PlacementAnswerState
    {
        public Guid QuestionId { get; set; }
        public bool IsCorrect { get; set; }
        public string Difficulty { get; set; } = "";
        public Guid? TopicId { get; set; }
    }
}
