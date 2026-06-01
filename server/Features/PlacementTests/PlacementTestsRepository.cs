using System.Collections.Concurrent;
using System.Text.Json;
using EduBoost.API.Features.PlacementTests.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.PlacementTests;

public interface IPlacementTestsRepository
{
    Task<StartPlacementTestResponse> StartTestAsync(Guid userId);
    Task<AnswerPlacementResponse> SubmitAnswerAsync(Guid userId, AnswerPlacementRequest request);
    Task<CompletePlacementResponse> CompleteTestAsync(Guid userId, string sessionId);
    Task<PlacementTestResultDto?> GetResultAsync(Guid userId);
}

public class PlacementTestsRepository(AppDbContext db) : IPlacementTestsRepository
{
    // In-memory session store for adaptive test state (in production, use Redis)
    private static readonly ConcurrentDictionary<string, PlacementSession> _sessions = new();

    private const int MinQuestions = 10;
    private const int MaxQuestions = 20;

    public async Task<StartPlacementTestResponse> StartTestAsync(Guid userId)
    {
        var sessionId = Guid.NewGuid().ToString();

        // Get questions from quiz pool across all topics, starting with medium difficulty
        var questions = await db.Questions
            .Include(q => q.Options)
            .Include(q => q.Quiz).ThenInclude(q => q!.Topic)
            .Where(q => q.Difficulty == "medium")
            .OrderBy(q => Guid.NewGuid())
            .Take(MaxQuestions)
            .ToListAsync();

        if (questions.Count == 0)
        {
            // Fallback: get any available questions
            questions = await db.Questions
                .Include(q => q.Options)
                .Include(q => q.Quiz).ThenInclude(q => q!.Topic)
                .OrderBy(q => Guid.NewGuid())
                .Take(MaxQuestions)
                .ToListAsync();
        }

        var session = new PlacementSession
        {
            UserId = userId,
            QuestionPool = questions.Select(q => q.Id).ToList(),
            CurrentDifficulty = "medium",
            CurrentIndex = 0,
            Answers = []
        };

        _sessions[sessionId] = session;

        var firstQuestion = questions.FirstOrDefault();
        if (firstQuestion == null)
            return new StartPlacementTestResponse
            {
                SessionId = sessionId,
                Question = new PlacementQuestionDto { Text = "Không có câu hỏi nào" },
                QuestionNumber = 0,
                TotalQuestions = 0
            };

        return new StartPlacementTestResponse
        {
            SessionId = sessionId,
            Question = MapQuestionToDto(firstQuestion),
            QuestionNumber = 1,
            TotalQuestions = Math.Min(questions.Count, MaxQuestions)
        };
    }

    public async Task<AnswerPlacementResponse> SubmitAnswerAsync(Guid userId, AnswerPlacementRequest request)
    {
        if (!_sessions.TryGetValue(request.SessionId, out var session))
            throw new InvalidOperationException("Session not found");

        var questionId = Guid.Parse(request.QuestionId);
        var question = await db.Questions
            .Include(q => q.Options)
            .Include(q => q.Quiz).ThenInclude(q => q!.Topic)
            .FirstOrDefaultAsync(q => q.Id == questionId);

        if (question == null)
            throw new InvalidOperationException("Question not found");

        // Check answer
        bool isCorrect;
        if (question.Type == "fill_blank")
        {
            isCorrect = string.Equals(question.CorrectAnswer?.Trim(), request.TextAnswer?.Trim(), StringComparison.OrdinalIgnoreCase);
        }
        else
        {
            var correctOption = question.Options.FirstOrDefault(o => o.IsCorrect);
            isCorrect = correctOption != null && correctOption.Id.ToString() == request.SelectedOptionId;
        }

        session.Answers.Add(new PlacementAnswer
        {
            QuestionId = questionId,
            IsCorrect = isCorrect,
            Difficulty = question.Difficulty,
            TopicId = question.Quiz?.TopicId
        });

        session.CurrentIndex++;

        // Adaptive: adjust difficulty based on recent performance
        var recentAnswers = session.Answers.TakeLast(3).ToList();
        var recentCorrect = recentAnswers.Count(a => a.IsCorrect);

        if (recentCorrect >= 2)
            session.CurrentDifficulty = session.CurrentDifficulty == "easy" ? "medium" : "hard";
        else if (recentCorrect == 0)
            session.CurrentDifficulty = session.CurrentDifficulty == "hard" ? "medium" : "easy";

        // Check if test should complete
        bool isComplete = session.CurrentIndex >= MaxQuestions ||
            (session.CurrentIndex >= MinQuestions && IsLevelStable(session));

        if (isComplete)
        {
            return new AnswerPlacementResponse
            {
                IsCorrect = isCorrect,
                IsComplete = true,
                NextQuestion = null,
                QuestionNumber = session.CurrentIndex,
                TotalQuestions = session.CurrentIndex
            };
        }

        // Get next question with adaptive difficulty
        var nextQuestion = await db.Questions
            .Include(q => q.Options)
            .Include(q => q.Quiz).ThenInclude(q => q!.Topic)
            .Where(q => q.Difficulty == session.CurrentDifficulty)
            .Where(q => !session.Answers.Select(a => a.QuestionId).Contains(q.Id))
            .OrderBy(q => Guid.NewGuid())
            .FirstOrDefaultAsync();

        // Fallback to any difficulty if none found
        nextQuestion ??= await db.Questions
            .Include(q => q.Options)
            .Include(q => q.Quiz).ThenInclude(q => q!.Topic)
            .Where(q => !session.Answers.Select(a => a.QuestionId).Contains(q.Id))
            .OrderBy(q => Guid.NewGuid())
            .FirstOrDefaultAsync();

        if (nextQuestion == null)
        {
            return new AnswerPlacementResponse
            {
                IsCorrect = isCorrect,
                IsComplete = true,
                NextQuestion = null,
                QuestionNumber = session.CurrentIndex,
                TotalQuestions = session.CurrentIndex
            };
        }

        return new AnswerPlacementResponse
        {
            IsCorrect = isCorrect,
            IsComplete = false,
            NextQuestion = MapQuestionToDto(nextQuestion),
            QuestionNumber = session.CurrentIndex + 1,
            TotalQuestions = MaxQuestions
        };
    }

    public async Task<CompletePlacementResponse> CompleteTestAsync(Guid userId, string sessionId)
    {
        if (!_sessions.TryRemove(sessionId, out var session))
            throw new InvalidOperationException("Session not found or already completed");

        // Calculate results
        var totalCorrect = session.Answers.Count(a => a.IsCorrect);
        var totalQuestions = session.Answers.Count;
        var finalScore = totalQuestions > 0 ? (double)totalCorrect / totalQuestions * 100 : 0;

        // Determine level based on performance at different difficulties
        var hardCorrect = session.Answers.Where(a => a.Difficulty == "hard").Select(a => a.IsCorrect ? 1.0 : 0.0).DefaultIfEmpty(0).Average();
        var mediumCorrect = session.Answers.Where(a => a.Difficulty == "medium").Select(a => a.IsCorrect ? 1.0 : 0.0).DefaultIfEmpty(0).Average();

        string level;
        if (hardCorrect >= 0.7)
            level = "advanced";
        else if (mediumCorrect >= 0.6)
            level = "intermediate";
        else
            level = "beginner";

        // Calculate per-topic strengths/weaknesses
        var topicScores = session.Answers
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

        // Persist result
        var result = new PlacementTestResult
        {
            UserId = userId,
            InitialLevel = level,
            FinalScore = finalScore,
            StrengthsJson = JsonSerializer.Serialize(strengths),
            WeaknessesJson = JsonSerializer.Serialize(weaknesses)
        };
        db.PlacementTestResults.Add(result);

        // Initialize BKT states for all topics
        foreach (var ts in topicScores)
        {
            var existing = await db.BktStates.FirstOrDefaultAsync(b => b.UserId == userId && b.TopicId == ts.TopicId);
            if (existing == null)
            {
                db.BktStates.Add(new BktState
                {
                    UserId = userId,
                    TopicId = ts.TopicId,
                    MasteryProbability = ts.Score * 0.5, // Initial P(L) based on test performance
                });
            }
        }

        // Initialize/update user profile
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

        await db.SaveChangesAsync();

        return new CompletePlacementResponse
        {
            ResultId = result.Id.ToString(),
            InitialLevel = level,
            FinalScore = finalScore,
            Strengths = strengths,
            Weaknesses = weaknesses
        };
    }

    public async Task<PlacementTestResultDto?> GetResultAsync(Guid userId)
    {
        var result = await db.PlacementTestResults
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync();

        if (result == null) return null;

        return new PlacementTestResultDto
        {
            Id = result.Id.ToString(),
            InitialLevel = result.InitialLevel,
            FinalScore = result.FinalScore,
            Strengths = string.IsNullOrEmpty(result.StrengthsJson) ? [] : JsonSerializer.Deserialize<List<TopicStrengthDto>>(result.StrengthsJson) ?? [],
            Weaknesses = string.IsNullOrEmpty(result.WeaknessesJson) ? [] : JsonSerializer.Deserialize<List<TopicStrengthDto>>(result.WeaknessesJson) ?? [],
            CreatedAt = result.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")
        };
    }

    private static bool IsLevelStable(PlacementSession session)
    {
        if (session.Answers.Count < 5) return false;
        var last5 = session.Answers.TakeLast(5).ToList();
        var correctRate = last5.Count(a => a.IsCorrect) / 5.0;
        // Stable if consistently good or consistently struggling
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

    private class PlacementSession
    {
        public Guid UserId { get; set; }
        public List<Guid> QuestionPool { get; set; } = [];
        public string CurrentDifficulty { get; set; } = "medium";
        public int CurrentIndex { get; set; }
        public List<PlacementAnswer> Answers { get; set; } = [];
    }

    private class PlacementAnswer
    {
        public Guid QuestionId { get; set; }
        public bool IsCorrect { get; set; }
        public string Difficulty { get; set; } = "";
        public Guid? TopicId { get; set; }
    }
}
