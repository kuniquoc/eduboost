using EduBoost.API.Features.Quizzes.Models;
using EduBoost.API.Features.Quizzes;
using EduBoost.API.Features.QuizPool.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using EduBoost.API.Infrastructure.Integrations.Storage;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.QuizPool;

public class PoolRepository(AppDbContext db, IStorageService storage, IAgentService agent) : IPoolRepository
{
    public async Task<QuizDto?> GeneratePoolQuizAsync(Guid userId, string userRole, GeneratePoolQuizRequest request)
    {
        // 1. Resolve Topic — by ID (preferred) or find/create by name
        Topic? topic = null;
        Guid? classGuid = string.IsNullOrEmpty(request.ClassId) ? null : Guid.Parse(request.ClassId);
        var difficulty = request.Difficulty;

        if (!string.IsNullOrEmpty(request.TopicId))
        {
            var topicGuid = Guid.Parse(request.TopicId);
            topic = await db.Topics.FindAsync(topicGuid);
            if (topic == null) return null;

            if (!classGuid.HasValue && topic.ClassId.HasValue)
                classGuid = topic.ClassId;

            request.TopicName = topic.Name;
            if (string.IsNullOrWhiteSpace(difficulty))
                difficulty = topic.Difficulty;
        }

        if (topic == null && userRole == "student")
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
        else if (topic == null) // teacher — find or create by name
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
        // Replace mode: delete all owner's pool quizzes in this topic first
        if (request.Mode == "replace")
        {
            var oldQuizzes = await db.Quizzes
                .Where(q => q.TopicId == topic.Id && q.Type == "pool" && q.OwnerId == userId)
                .ToListAsync();
            if (oldQuizzes.Count > 0)
            {
                db.Quizzes.RemoveRange(oldQuizzes);
                await db.SaveChangesAsync();
            }
        }

        var existingPoolQuestions = new List<string>();
        if (request.Mode != "replace")
        {
            existingPoolQuestions = await db.Questions
                .Where(q => q.Quiz.TopicId == topic.Id && q.Quiz.Type == "pool")
                .OrderByDescending(q => q.OrderIndex)
                .Select(q => q.Text)
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Distinct()
                .Take(150)
                .ToListAsync();
        }

        // When per-difficulty counts are set, use "mixed" difficulty
        var hasPerDifficultyCounts = (request.NumEasyQuestions ?? 0) + (request.NumMediumQuestions ?? 0) + (request.NumHardQuestions ?? 0) > 0;
        if (hasPerDifficultyCounts) difficulty = "mixed";

        var aiResponse = await agent.GenerateQuizBatchAsync(
            topic.Name, request.UserSuggestion, downloadUrl, request.NumQuestions, difficulty,
            numEasy: request.NumEasyQuestions ?? 0,
            numMedium: request.NumMediumQuestions ?? 0,
            numHard: request.NumHardQuestions ?? 0,
            documentId: request.DocumentId,
            existingQuestions: existingPoolQuestions);

        if (aiResponse == null || aiResponse.Questions.Count == 0)
        {
            return null;
        }

        var validQuestions = AgentQuizValidation.FilterQuestionsWithSingleCorrectOption(aiResponse.Questions);
        if (validQuestions.Count == 0)
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
            Questions = validQuestions.Select((q, qidx) => new Question
            {
                Id = Guid.NewGuid(),
                Text = q.Question,
                Type = q.Type,
                Difficulty = q.Difficulty,
                DifficultyIndex = QuestionMapper.ResolveDifficultyIndex(q.DifficultyIndex, q.Difficulty),
                IsEstimatedDifficultyIndex = !q.DifficultyIndex.HasValue,
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

    public async Task<List<Guid>> GetPoolQuizIdsForQuestionsAsync(IEnumerable<Guid> questionIds)
    {
        var ids = questionIds.ToList();
        if (ids.Count == 0) return [];

        return await db.Questions
            .Where(q => ids.Contains(q.Id) && q.Quiz.Type == "pool")
            .Select(q => q.QuizId)
            .Distinct()
            .ToListAsync();
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
            Questions = q.Questions.OrderBy(qu => qu.OrderIndex).Select(QuestionMapper.ToDto).ToList()
        }).ToList();
    }

    public async Task<DeletePoolQuizResult> DeletePoolQuizAsync(Guid userId, Guid quizId)
    {
        var quiz = await db.Quizzes.FindAsync(quizId);
        if (quiz == null) return DeletePoolQuizResult.NotFound;

        // Check ownership (either OwnerId matches or teacher of the class)
        bool isOwner = quiz.OwnerId == userId;
        if (!isOwner && quiz.ClassId.HasValue)
        {
            var cls = await db.Classes.FindAsync(quiz.ClassId.Value);
            isOwner = cls != null && cls.TeacherId == userId;
        }

        if (!isOwner) return DeletePoolQuizResult.Forbidden;

        db.Quizzes.Remove(quiz);
        await db.SaveChangesAsync();
        return DeletePoolQuizResult.Success;
    }

    public async Task<QuizDto> CreateTestFromPoolAsync(Guid userId, CreateTestFromPoolRequest request)
    {
        var classGuid = Guid.Parse(request.ClassId);

        // Fetch selected pool quizzes and their questions
        var poolQuizGuids = request.PoolQuizIds.Select(Guid.Parse).ToList();
        var poolQuestions = await db.Questions
            .Where(q => poolQuizGuids.Contains(q.QuizId) && q.Quiz.Type == "pool")
            .Include(q => q.Options)
            .Include(q => q.Quiz)
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
            Questions = poolQuestions.Select((q, qidx) => CopyPoolQuestion(q, qidx, verifiedByTeacher: true)).ToList()
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

    public async Task<QuizDto?> CreateEntryTestFromPoolAsync(Guid userId, CreateEntryTestFromPoolRequest request)
    {
        var classGuid = Guid.Parse(request.ClassId);
        var existingEntry = await db.Quizzes.AnyAsync(q => q.ClassId == classGuid && q.Type == "entry_test");
        if (existingEntry) return null;

        var poolQuestions = await LoadPoolQuestionsForSelectionAsync(request);
        if (poolQuestions.Count == 0)
            throw new InvalidOperationException("Không có câu hỏi nào được chọn từ pool");

        var cls = await db.Classes.FindAsync(classGuid);
        var quiz = new Quiz
        {
            Id = Guid.NewGuid(),
            Title = string.IsNullOrWhiteSpace(request.Title)
                ? $"Bài test đầu vào — {cls?.Name ?? "Lớp học"}"
                : request.Title.Trim(),
            Type = "entry_test",
            IsPublished = false,
            CreatedAt = DateTime.UtcNow,
            ClassId = classGuid,
            OwnerId = userId,
            Questions = poolQuestions.Select((q, qidx) => CopyPoolQuestion(q, qidx, verifiedByTeacher: true)).ToList()
        };

        db.Quizzes.Add(quiz);

        // Auto-set as active entry test if the class has none yet
        if (cls != null && cls.ActiveEntryTestId == null)
            cls.ActiveEntryTestId = quiz.Id;

        await db.SaveChangesAsync();

        return new QuizDto
        {
            Id = quiz.Id.ToString(),
            ClassId = classGuid.ToString(),
            TopicId = null,
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
            .Include(q => q.Quiz)
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
            Questions = poolQuestions.Select((q, qidx) => CopyPoolQuestion(q, qidx, verifiedByTeacher: false)).ToList()
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

    // ── Helpers ─────────────────────────────────────────────────────────────

    private async Task<List<Question>> LoadPoolQuestionsForSelectionAsync(CreateEntryTestFromPoolRequest request)
    {
        var result = new List<Question>();
        var seen = new HashSet<Guid>();

        if (request.QuestionIds.Count > 0)
        {
            var questionGuids = request.QuestionIds.Select(Guid.Parse).ToList();
            var byId = await db.Questions
                .Where(q => questionGuids.Contains(q.Id) && q.Quiz.Type == "pool")
                .Include(q => q.Options)
                .Include(q => q.Quiz)
                .ToDictionaryAsync(q => q.Id);

            foreach (var id in questionGuids)
            {
                if (byId.TryGetValue(id, out var q) && seen.Add(q.Id))
                    result.Add(q);
            }
        }

        if (request.PoolQuizIds.Count > 0)
        {
            var poolQuizGuids = request.PoolQuizIds.Select(Guid.Parse).ToList();
            var batchQuestions = await db.Questions
                .Where(q => poolQuizGuids.Contains(q.QuizId) && q.Quiz.Type == "pool")
                .Include(q => q.Options)
                .Include(q => q.Quiz)
                .OrderBy(q => q.OrderIndex)
                .ToListAsync();

            foreach (var q in batchQuestions)
            {
                if (seen.Add(q.Id))
                    result.Add(q);
            }
        }

        return result;
    }

    private static Question CopyPoolQuestion(Question question, int orderIndex, bool verifiedByTeacher) =>
        QuestionMapper.CloneForQuiz(question, orderIndex, verifiedByTeacher);

    public async Task<TopicPoolDto?> RenameTopicAsync(Guid userId, string userRole, Guid topicId, string newName)
    {
        var topic = await db.Topics.FindAsync(topicId);
        if (topic == null) return null;

        // Authorization: private topic — must be owner; class-linked topic — teacher must own the class
        if (topic.ClassId.HasValue)
        {
            if (userRole != "teacher") return null;
            var classOwned = await db.Classes.AnyAsync(c => c.Id == topic.ClassId.Value && c.TeacherId == userId);
            if (!classOwned) return null;
        }
        else
        {
            if (topic.OwnerId != userId) return null;
        }

        topic.Name = newName.Trim();
        await db.SaveChangesAsync();

        return new TopicPoolDto
        {
            Id = topic.Id.ToString(),
            Name = topic.Name,
            Description = topic.Description,
            Difficulty = topic.Difficulty,
            ClassId = topic.ClassId?.ToString(),
            OwnerId = topic.OwnerId?.ToString(),
            QuizCount = await db.Quizzes.CountAsync(q => q.TopicId == topic.Id && q.Type == "pool"),
            QuestionCount = await db.Questions.CountAsync(q => q.Quiz.TopicId == topic.Id && q.Quiz.Type == "pool")
        };
    }

    public async Task<PoolQuestionRef?> GetPoolQuestionAsync(Guid questionId)
    {
        var question = await db.Questions
            .AsNoTracking()
            .Include(q => q.Quiz)
            .FirstOrDefaultAsync(q => q.Id == questionId && q.Quiz != null && q.Quiz.Type == "pool");
        if (question?.Quiz?.TopicId is not Guid topicId) return null;
        return new PoolQuestionRef(questionId, topicId);
    }

}
