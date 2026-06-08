using EduBoost.API.Features.Quizzes.Models;
using EduBoost.API.Features.QuizPool.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Services;
using EduBoost.API.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.QuizPool;

public class PoolRepository(AppDbContext db, IStorageService storage, IAgentService agent) : IPoolRepository
{
    public async Task<QuizDto?> GeneratePoolQuizAsync(Guid userId, string userRole, GeneratePoolQuizRequest request)
    {
        // 1. Find or create Topic by Name
        Topic? topic = null;
        Guid? classGuid = string.IsNullOrEmpty(request.ClassId) ? null : Guid.Parse(request.ClassId);

        if (userRole == "student")
        {
            // Students can only create private topics
            topic = await db.Topics.FirstOrDefaultAsync(t => t.Name == request.TopicName && t.OwnerId == userId && t.ClassId == null);
            if (topic == null)
            {
                topic = new Topic
                {
                    Id = Guid.NewGuid(),
                    Name = request.TopicName,
                    Description = $"Chủ đề ôn tập riêng của Học sinh: {request.TopicName}",
                    Difficulty = request.Difficulty,
                    AiEvaluated = false,
                    IsDocumentVisible = false,
                    OwnerId = userId,
                    ClassId = null,
                    CreatedAt = DateTime.UtcNow
                };
                db.Topics.Add(topic);
                await db.SaveChangesAsync();
            }
        }
        else // teacher
        {
            if (classGuid.HasValue)
            {
                // Class-bound topic
                topic = await db.Topics.FirstOrDefaultAsync(t => t.Name == request.TopicName && t.ClassId == classGuid);
                if (topic == null)
                {
                    topic = new Topic
                    {
                        Id = Guid.NewGuid(),
                        Name = request.TopicName,
                        Description = $"Chủ đề môn học của lớp: {request.TopicName}",
                        Difficulty = request.Difficulty,
                        AiEvaluated = false,
                        IsDocumentVisible = true,
                        ClassId = classGuid.Value,
                        OwnerId = userId,
                        CreatedAt = DateTime.UtcNow
                    };
                    db.Topics.Add(topic);
                    await db.SaveChangesAsync();
                }
            }
            else
            {
                // Global / private teacher topic
                topic = await db.Topics.FirstOrDefaultAsync(t => t.Name == request.TopicName && t.OwnerId == userId && t.ClassId == null);
                if (topic == null)
                {
                    topic = new Topic
                    {
                        Id = Guid.NewGuid(),
                        Name = request.TopicName,
                        Description = $"Chủ đề cá nhân của Giáo viên: {request.TopicName}",
                        Difficulty = request.Difficulty,
                        AiEvaluated = false,
                        IsDocumentVisible = false,
                        OwnerId = userId,
                        ClassId = null,
                        CreatedAt = DateTime.UtcNow
                    };
                    db.Topics.Add(topic);
                    await db.SaveChangesAsync();
                }
            }
        }

        // 2. Resolve presigned document download URL if provided
        string? downloadUrl = null;
        if (!string.IsNullOrEmpty(request.DocumentId))
        {
            var docId = Guid.Parse(request.DocumentId);
            var doc = await db.Documents.FindAsync(docId);
            if (doc != null && doc.StorageKey != null)
            {
                string bucket = doc.Scope == "student" ? MinioStorageService.Buckets.StudentDocuments : MinioStorageService.Buckets.ClassDocuments;
                downloadUrl = await storage.GetInternalPresignedDownloadUrlAsync(bucket, doc.StorageKey, 3600);
            }
        }

        // 3. Request Batch Quiz Questions from AI agent
        var aiResponse = await agent.GenerateQuizBatchAsync(
            topic.Name, request.UserSuggestion, downloadUrl, request.NumQuestions, request.Difficulty,
            documentId: request.DocumentId);

        if (aiResponse == null || aiResponse.Questions.Count == 0)
        {
            return null;
        }

        // 4. Create and save a new Quiz of type "pool" containing generated questions
        var quiz = new Quiz
        {
            Id = Guid.NewGuid(),
            Title = $"{topic.Name} - [AI Generated] {DateTime.Now:dd/MM/yyyy HH:mm}",
            Type = "pool",
            IsPublished = false,
            CreatedAt = DateTime.UtcNow,
            ClassId = classGuid,
            TopicId = topic.Id,
            OwnerId = userId,
            Questions = aiResponse.Questions.Select((q, qidx) => new Question
            {
                Id = Guid.NewGuid(),
                Text = q.Question,
                Type = q.Type,
                Difficulty = q.Difficulty,
                Explanation = q.Explanation,
                CorrectAnswer = q.Options.FirstOrDefault(o => o.IsCorrect)?.Text ?? "",
                VerifiedByTeacher = false,
                OrderIndex = qidx,
                Options = q.Options.Select((o, oidx) => new QuizOption
                {
                    Id = Guid.NewGuid(),
                    Text = o.Text,
                    IsCorrect = o.IsCorrect,
                    OrderIndex = oidx
                }).ToList()
            }).ToList()
        };

        db.Quizzes.Add(quiz);
        await db.SaveChangesAsync();

        return new QuizDto
        {
            Id = quiz.Id.ToString(),
            ClassId = quiz.ClassId?.ToString() ?? "",
            TopicId = quiz.TopicId?.ToString(),
            Title = quiz.Title,
            Type = quiz.Type,
            IsPublished = quiz.IsPublished,
            QuestionCount = quiz.Questions.Count,
            CreatedAt = quiz.CreatedAt.ToString("o")
        };
    }

    public async Task<List<TopicPoolDto>> GetTopicsInPoolAsync(Guid userId, string userRole, string? search, Guid? classId)
    {
        var query = db.Topics.AsQueryable();

        if (userRole == "student")
        {
            // Students see their private topics and class topics they are enrolled in
            var enrolledClassIds = await db.Enrollments
                .Where(e => e.StudentId == userId)
                .Select(e => e.ClassId)
                .ToListAsync();

            query = query.Where(t => t.OwnerId == userId || (t.ClassId.HasValue && enrolledClassIds.Contains(t.ClassId.Value)));
        }
        else // teacher
        {
            if (classId.HasValue)
            {
                query = query.Where(t => t.ClassId == classId.Value);
            }
            else
            {
                // General teacher pool covers taught classes topics and private topics
                var taughtClassIds = await db.Classes
                    .Where(c => c.TeacherId == userId)
                    .Select(c => c.Id)
                    .ToListAsync();

                query = query.Where(t => t.OwnerId == userId || (t.ClassId.HasValue && taughtClassIds.Contains(t.ClassId.Value)));
            }
        }

        if (!string.IsNullOrEmpty(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(t => t.Name.ToLower().Contains(searchLower));
        }

        var topics = await query
            .Include(t => t.Quizzes)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        // Calculate counts
        return topics.Select(t => new TopicPoolDto
        {
            Id = t.Id.ToString(),
            Name = t.Name,
            Description = t.Description,
            Difficulty = t.Difficulty,
            ClassId = t.ClassId?.ToString(),
            OwnerId = t.OwnerId?.ToString(),
            QuizCount = db.Quizzes.Count(q => q.TopicId == t.Id && q.Type == "pool"),
            QuestionCount = db.Questions.Count(q => q.Quiz.TopicId == t.Id && q.Quiz.Type == "pool")
        }).ToList();
    }

    public async Task<List<PoolQuizDetailDto>> GetQuizzesInTopicPoolAsync(Guid userId, Guid topicId)
    {
        var quizzes = await db.Quizzes
            .Where(q => q.TopicId == topicId && q.Type == "pool")
            .Include(q => q.Questions)
                .ThenInclude(qu => qu.Options)
            .OrderByDescending(q => q.CreatedAt)
            .ToListAsync();

        return quizzes.Select(q => new PoolQuizDetailDto
        {
            QuizId = q.Id.ToString(),
            Title = q.Title,
            CreatedAt = q.CreatedAt.ToString("o"),
            Questions = q.Questions.OrderBy(qu => qu.OrderIndex).Select(MapToDto).ToList()
        }).ToList();
    }

    public async Task<bool> DeletePoolQuizAsync(Guid userId, Guid quizId)
    {
        var quiz = await db.Quizzes.FindAsync(quizId);
        if (quiz == null) return false;

        // Check ownership (either OwnerId matches or teacher of the class)
        bool isOwner = quiz.OwnerId == userId;
        if (!isOwner && quiz.ClassId.HasValue)
        {
            var cls = await db.Classes.FindAsync(quiz.ClassId.Value);
            isOwner = cls != null && cls.TeacherId == userId;
        }

        if (!isOwner) return false;

        db.Quizzes.Remove(quiz);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<QuizDto> CreateTestFromPoolAsync(Guid userId, CreateTestFromPoolRequest request)
    {
        var classGuid = Guid.Parse(request.ClassId);

        // Fetch selected pool quizzes and their questions
        var poolQuizGuids = request.PoolQuizIds.Select(Guid.Parse).ToList();
        var poolQuestions = await db.Questions
            .Where(q => poolQuizGuids.Contains(q.QuizId) && q.Quiz.Type == "pool")
            .Include(q => q.Options)
            .ToListAsync();

        // Create new quiz for the test
        var quiz = new Quiz
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Type = "practice", // practice test published to class
            IsPublished = false, // Teacher can publish it later
            CreatedAt = DateTime.UtcNow,
            ClassId = classGuid,
            OwnerId = userId,
            Questions = poolQuestions.Select((q, qidx) => new Question
            {
                Id = Guid.NewGuid(),
                Text = q.Text,
                Type = q.Type,
                Difficulty = q.Difficulty,
                Explanation = q.Explanation,
                CorrectAnswer = q.CorrectAnswer,
                VerifiedByTeacher = true, // already verified by picking
                OrderIndex = qidx,
                Options = q.Options.Select((o, oidx) => new QuizOption
                {
                    Id = Guid.NewGuid(),
                    Text = o.Text,
                    IsCorrect = o.IsCorrect,
                    OrderIndex = oidx
                }).ToList()
            }).ToList()
        };

        db.Quizzes.Add(quiz);
        await db.SaveChangesAsync();

        return new QuizDto
        {
            Id = quiz.Id.ToString(),
            ClassId = quiz.ClassId?.ToString() ?? "",
            TopicId = quiz.TopicId?.ToString(),
            Title = quiz.Title,
            Type = quiz.Type,
            IsPublished = quiz.IsPublished,
            QuestionCount = quiz.Questions.Count,
            CreatedAt = quiz.CreatedAt.ToString("o")
        };
    }

    public async Task<QuizDto> CreateRevisionSetFromPoolAsync(Guid userId, CreateRevisionSetFromPoolRequest request)
    {
        // Fetch selected pool quizzes and their questions
        var poolQuizGuids = request.PoolQuizIds.Select(Guid.Parse).ToList();
        var poolQuestions = await db.Questions
            .Where(q => poolQuizGuids.Contains(q.QuizId) && q.Quiz.Type == "pool")
            .Include(q => q.Options)
            .ToListAsync();

        // Create private quiz revision set
        var quiz = new Quiz
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Type = "private", // private revision set
            IsPublished = true, // instantly ready for practice
            CreatedAt = DateTime.UtcNow,
            OwnerId = userId,
            Questions = poolQuestions.Select((q, qidx) => new Question
            {
                Id = Guid.NewGuid(),
                Text = q.Text,
                Type = q.Type,
                Difficulty = q.Difficulty,
                Explanation = q.Explanation,
                CorrectAnswer = q.CorrectAnswer,
                VerifiedByTeacher = false,
                OrderIndex = qidx,
                Options = q.Options.Select((o, oidx) => new QuizOption
                {
                    Id = Guid.NewGuid(),
                    Text = o.Text,
                    IsCorrect = o.IsCorrect,
                    OrderIndex = oidx
                }).ToList()
            }).ToList()
        };

        db.Quizzes.Add(quiz);
        await db.SaveChangesAsync();

        return new QuizDto
        {
            Id = quiz.Id.ToString(),
            ClassId = "",
            TopicId = null,
            Title = quiz.Title,
            Type = quiz.Type,
            IsPublished = quiz.IsPublished,
            QuestionCount = quiz.Questions.Count,
            CreatedAt = quiz.CreatedAt.ToString("o")
        };
    }

    public async Task<List<QuizDto>> GetRevisionSetsAsync(Guid userId)
    {
        return await db.Quizzes
            .Where(q => q.OwnerId == userId && q.Type == "private")
            .OrderByDescending(q => q.CreatedAt)
            .Select(q => new QuizDto
            {
                Id = q.Id.ToString(),
                ClassId = "",
                TopicId = q.TopicId.HasValue ? q.TopicId.Value.ToString() : null,
                Title = q.Title,
                Type = q.Type,
                IsPublished = q.IsPublished,
                QuestionCount = q.Questions.Count,
                CreatedAt = q.CreatedAt.ToString("o")
            })
            .ToListAsync();
    }

    // ── Helper ──────────────────────────────────────────────────────────────
    private static QuestionDto MapToDto(Question q) => new()
    {
        Id = q.Id.ToString(),
        QuizId = q.QuizId.ToString(),
        TopicId = q.Quiz?.TopicId?.ToString() ?? "",
        Text = q.Text,
        Type = q.Type,
        Difficulty = q.Difficulty,
        Explanation = q.Explanation,
        CorrectAnswer = q.CorrectAnswer,
        VerifiedByTeacher = q.VerifiedByTeacher,
        OrderIndex = q.OrderIndex,
        Options = q.Options.OrderBy(o => o.OrderIndex).Select(o => new OptionDto
        {
            Id = o.Id.ToString(),
            Text = o.Text,
            IsCorrect = o.IsCorrect
        }).ToList()
    };
}
