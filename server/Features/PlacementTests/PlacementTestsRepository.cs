using System.Text.Json;
using EduBoost.API.Features.LearningStates;
using EduBoost.API.Features.LearningStates.Models;
using EduBoost.API.Features.PlacementTests.Models;
using EduBoost.API.Features.PracticeSessions.Models;
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
    Task<List<QuizReviewItemDto>?> GetReviewAsync(Guid userId, Guid resultId);
}

public class PlacementTestsRepository(AppDbContext db, IRoadmapRepository roadmap, ILearningStatesRepository learningStates) : IPlacementTestsRepository
{
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

        // Resolve active entry test quiz ID (if any) before loading pool
        Guid? activeEntryTestQuizId = null;
        if (classId.HasValue)
        {
            var cls = await db.Classes.FindAsync(classId.Value);
            if (cls?.ActiveEntryTestId != null)
            {
                var activeQuiz = await db.Quizzes.FindAsync(cls.ActiveEntryTestId);
                if (activeQuiz?.IsPublished == true)
                    activeEntryTestQuizId = activeQuiz.Id;
            }
        }

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
            ActiveEntryTestQuizId = activeEntryTestQuizId,
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
            TotalQuestions = state.QuestionPool.Count
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

        var topicId = question.SourceTopicId ?? question.Quiz?.TopicId;

        state.Answers.Add(new PlacementAnswerState
        {
            QuestionId = questionId,
            SelectedOptionId = selectedOptionId,
            TextAnswer = request.TextAnswer,
            IsCorrect = isCorrect,
            Difficulty = question.Difficulty,
            TopicId = topicId
        });
        state.CurrentIndex++;

        if (topicId != null)
        {
            await learningStates.UpdateAfterAnswerAsync(userId, new UpdateBktRequest
            {
                TopicId = topicId.Value,
                QuestionId = questionId,
                IsCorrect = isCorrect,
                QuestionDifficultyIndex = question.DifficultyIndex
            });
        }

        var recentAnswers = state.Answers.TakeLast(3).ToList();
        var recentCorrect = recentAnswers.Count(a => a.IsCorrect);
        if (recentCorrect >= 2)
            state.CurrentDifficulty = state.CurrentDifficulty == "easy" ? "medium" : "hard";
        else if (recentCorrect == 0)
            state.CurrentDifficulty = state.CurrentDifficulty == "hard" ? "medium" : "easy";

        bool isComplete = state.CurrentIndex >= state.QuestionPool.Count;

        if (isComplete)
        {
            await SaveSessionStateAsync(session, state);
            return new AnswerPlacementResponse
            {
                FeedbackSuppressed = true,
                IsComplete = true,
                NextQuestion = null,
                QuestionNumber = state.CurrentIndex,
                TotalQuestions = state.QuestionPool.Count
            };
        }

        var nextQuestion = await ResolveNextQuestionFromPoolAsync(state);

        if (nextQuestion == null)
        {
            await SaveSessionStateAsync(session, state);
            return new AnswerPlacementResponse
            {
                FeedbackSuppressed = true,
                IsComplete = true,
                NextQuestion = null,
                QuestionNumber = state.CurrentIndex,
                TotalQuestions = state.QuestionPool.Count
            };
        }

        await SaveSessionStateAsync(session, state);
        return new AnswerPlacementResponse
        {
            FeedbackSuppressed = true,
            IsComplete = false,
            NextQuestion = MapQuestionToDto(nextQuestion),
            QuestionNumber = state.CurrentIndex + 1,
            TotalQuestions = state.QuestionPool.Count
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

        var reviewItems = await BuildReviewItemsAsync(state.Answers);

        var result = new PlacementTestResult
        {
            UserId = userId,
            ClassId = state.ClassId,
            InitialLevel = level,
            FinalScore = finalScore,
            StrengthsJson = JsonSerializer.Serialize(strengths),
            WeaknessesJson = JsonSerializer.Serialize(weaknesses),
            AnswersJson = JsonSerializer.Serialize(reviewItems)
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
            ClassId = state.ClassId?.ToString(),
            ReviewItems = reviewItems
        };
    }

    public async Task<PlacementTestResultDto?> GetResultAsync(Guid userId, Guid? classId = null)
    {
        var query = db.PlacementTestResults.Where(r => r.UserId == userId);
        if (classId.HasValue)
            query = query.Where(r => r.ClassId == classId);

        var result = await query.OrderByDescending(r => r.CreatedAt).FirstOrDefaultAsync();
        if (result == null) return null;

        var reviewItems = DeserializeReviewItems(result.AnswersJson);

        return new PlacementTestResultDto
        {
            Id = result.Id.ToString(),
            ClassId = result.ClassId?.ToString(),
            InitialLevel = result.InitialLevel,
            FinalScore = result.FinalScore,
            Strengths = string.IsNullOrEmpty(result.StrengthsJson) ? [] : JsonSerializer.Deserialize<List<TopicStrengthDto>>(result.StrengthsJson) ?? [],
            Weaknesses = string.IsNullOrEmpty(result.WeaknessesJson) ? [] : JsonSerializer.Deserialize<List<TopicStrengthDto>>(result.WeaknessesJson) ?? [],
            CreatedAt = result.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
            ReviewItems = reviewItems
        };
    }

    public async Task<List<QuizReviewItemDto>?> GetReviewAsync(Guid userId, Guid resultId)
    {
        var result = await db.PlacementTestResults
            .FirstOrDefaultAsync(r => r.Id == resultId && r.UserId == userId);
        if (result == null) return null;
        return DeserializeReviewItems(result.AnswersJson);
    }

    private async Task<List<QuizReviewItemDto>> BuildReviewItemsAsync(List<PlacementAnswerState> answers)
    {
        if (answers.Count == 0) return [];

        var questionIds = answers.Select(a => a.QuestionId).ToList();
        var questions = await db.Questions
            .Include(q => q.Options)
            .Where(q => questionIds.Contains(q.Id))
            .ToListAsync();

        return answers.Select(a =>
        {
            var q = questions.First(rq => rq.Id == a.QuestionId);
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

    private static List<QuizReviewItemDto>? DeserializeReviewItems(string? json) =>
        string.IsNullOrEmpty(json) ? null : JsonSerializer.Deserialize<List<QuizReviewItemDto>>(json);

    private async Task<List<Question>> LoadQuestionPoolAsync(Guid? classId)
    {
        // Prefer questions from the active published entry_test quiz
        if (classId.HasValue)
        {
            var cls = await db.Classes.FindAsync(classId.Value);
            if (cls?.ActiveEntryTestId != null)
            {
                var activeQuiz = await db.Quizzes.FindAsync(cls.ActiveEntryTestId);
                if (activeQuiz?.IsPublished == true)
                {
                    return await db.Questions
                        .Include(q => q.Options)
                        .Include(q => q.Quiz).ThenInclude(q => q!.Topic)
                        .Where(q => q.QuizId == cls.ActiveEntryTestId)
                        .OrderBy(q => q.OrderIndex)
                        .ToListAsync();
                }
            }
        }

        // Fallback: any class question
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

    private async Task<Question?> ResolveNextQuestionFromPoolAsync(PlacementSessionState state)
    {
        if (state.CurrentIndex < 0 || state.CurrentIndex >= state.QuestionPool.Count)
            return null;

        var nextQuestionId = state.QuestionPool[state.CurrentIndex];
        return await db.Questions
            .Include(q => q.Options)
            .Include(q => q.Quiz).ThenInclude(q => q!.Topic)
            .FirstOrDefaultAsync(q => q.Id == nextQuestionId);
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
        /// <summary>Quiz ID của active entry_test được dùng để giới hạn câu hỏi</summary>
        public Guid? ActiveEntryTestQuizId { get; set; }
        public List<Guid> QuestionPool { get; set; } = [];
        public string CurrentDifficulty { get; set; } = "medium";
        public int CurrentIndex { get; set; }
        public List<PlacementAnswerState> Answers { get; set; } = [];
    }

    private class PlacementAnswerState
    {
        public Guid QuestionId { get; set; }
        public string? SelectedOptionId { get; set; }
        public string? TextAnswer { get; set; }
        public bool IsCorrect { get; set; }
        public string Difficulty { get; set; } = "";
        public Guid? TopicId { get; set; }
    }
}
