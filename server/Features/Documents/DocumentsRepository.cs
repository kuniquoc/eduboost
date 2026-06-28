using EduBoost.API.Features.Documents.Models;
using EduBoost.API.Features.Quizzes;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using EduBoost.API.Infrastructure.Integrations.Storage;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Documents;

public interface IDocumentsRepository
{
    // Class documents
    Task<List<DocumentDto>> GetByClassIdAsync(Guid classId, string? userRole = null);
    Task<UploadUrlDto> RequestClassUploadUrlAsync(Guid classId, Guid teacherId, RequestUploadUrlRequest request);
    Task<DocumentDto?> ConfirmClassUploadAsync(Guid classId, Guid teacherId, string documentId);
    Task<bool> DeleteClassDocumentAsync(Guid classId, Guid docId);
    Task<GenerateQuizJobDto> GenerateQuizFromDocumentAsync(Guid classId, Guid docId, GenerateQuizRequest request);
    Task<DownloadUrlDto?> GetClassDocumentDownloadUrlAsync(Guid classId, Guid docId);

    // Student private documents
    Task<List<DocumentDto>> GetMyDocumentsAsync(Guid studentId);
    Task<UploadUrlDto> RequestStudentUploadUrlAsync(Guid studentId, RequestUploadUrlRequest request);
    Task<DocumentDto?> ConfirmStudentUploadAsync(Guid studentId, string documentId);
    Task<GenerateQuizJobDto> GenerateMyQuizAsync(Guid studentId, Guid docId, GenerateQuizRequest request);
    Task<bool> DeleteMyDocumentAsync(Guid studentId, Guid docId);
    Task<DownloadUrlDto?> GetStudentDocumentDownloadUrlAsync(Guid studentId, Guid docId);

    Task<DocumentDto?> GetByIdAsync(Guid docId);
    Task<List<string>> GetAllowedDocumentIdsAsync(Guid userId);

    // Topic & visibility management
    Task<DocumentDto?> UpdateDocumentTopicAsync(Guid classId, Guid docId, string? topicId);
    Task<DocumentDto?> UpdateDocumentVisibilityAsync(Guid classId, Guid docId, bool isVisible);
}

public partial class DocumentsRepository : IDocumentsRepository
{
    private readonly AppDbContext db;
    private readonly IStorageService storage;
    private readonly IAgentService agent;
    private readonly ILogger<DocumentsRepository> logger;
    private readonly IDocumentIngestQueue ingestQueue;

    public DocumentsRepository(
        AppDbContext db,
        IStorageService storage,
        IAgentService agent,
        ILogger<DocumentsRepository> logger,
        IDocumentIngestQueue ingestQueue)
    {
        this.db = db;
        this.storage = storage;
        this.agent = agent;
        this.logger = logger;
        this.ingestQueue = ingestQueue;
    }

    private const string ClassBucket = MinioStorageService.Buckets.ClassDocuments;
    private const string StudentBucket = MinioStorageService.Buckets.StudentDocuments;

    // ── Class documents ───────────────────────────────────────────────────────
    public async Task<DocumentDto?> GetByIdAsync(Guid docId)
    {
        var doc = await db.Documents.FindAsync(docId);
        return doc is null ? null : MapToDto(doc);
    }

    private async Task<string?> ResolveDocumentDownloadUrlAsync(Document doc)
    {
        if (doc.StorageKey == null) return null;

        var bucket = doc.Scope == "student" ? StudentBucket : ClassBucket;
        return await storage.GetInternalPresignedDownloadUrlAsync(bucket, doc.StorageKey, 3600);
    }

    private Task ScheduleBackgroundIngest(
        Guid documentId,
        string documentScope,
        string? classId = null,
        string? topicId = null,
        string? ownerId = null) =>
        ingestQueue.EnqueueAsync(new DocumentIngestJob(
            documentId, documentScope, classId, topicId, ownerId)).AsTask();

    private static async Task<string?> ResolveDocumentDownloadUrlAsync(Document doc, IStorageService scopedStorage)
    {
        if (doc.StorageKey == null) return null;

        var bucket = doc.Scope == "student" ? StudentBucket : ClassBucket;
        return await scopedStorage.GetInternalPresignedDownloadUrlAsync(bucket, doc.StorageKey, 3600);
    }

    private async Task<(string topicName, Guid topicId)> ResolveOrCreateStudentTopicFromDocumentAsync(
        Guid studentId, Document doc, string difficulty)
    {
        var topicName = Path.GetFileNameWithoutExtension(doc.FileName).Trim();
        if (string.IsNullOrWhiteSpace(topicName))
            topicName = "Ôn tập cá nhân";

        var topic = await db.Topics.FirstOrDefaultAsync(t =>
            t.Name == topicName && t.OwnerId == studentId && t.ClassId == null);

        if (topic == null)
        {
            topic = new Topic
            {
                Id = Guid.NewGuid(),
                Name = topicName,
                Description = $"Chủ đề ôn tập từ tài liệu: {doc.FileName}",
                Difficulty = difficulty,
                AiEvaluated = false,
                IsDocumentVisible = false,
                OwnerId = studentId,
                ClassId = null,
                CreatedAt = DateTime.UtcNow
            };
            db.Topics.Add(topic);
            await db.SaveChangesAsync();
        }

        return (topicName, topic.Id);
    }

    private async Task<(string topicName, string difficulty, Guid? topicId)> ResolveTopicContextAsync(
        string? requestTopicId,
        Guid? documentTopicId,
        string fileName,
        string defaultDifficulty)
    {
        Guid? resolvedTopicId = null;

        if (!string.IsNullOrWhiteSpace(requestTopicId) && Guid.TryParse(requestTopicId, out var parsed))
        {
            resolvedTopicId = parsed;
        }
        else if (documentTopicId.HasValue)
        {
            resolvedTopicId = documentTopicId.Value;
        }

        if (resolvedTopicId.HasValue)
        {
            var topic = await db.Topics.FirstOrDefaultAsync(t => t.Id == resolvedTopicId.Value);
            if (topic != null)
            {
                return (topic.Name, topic.Difficulty, topic.Id);
            }
        }

        var fallbackTopic = Path.GetFileNameWithoutExtension(fileName);
        if (string.IsNullOrWhiteSpace(fallbackTopic)) fallbackTopic = "Tài liệu lớp";
        return (fallbackTopic, defaultDifficulty, null);
    }

    private async Task<List<AgentQuizBatchQuestion>> GenerateDocumentQuestionsAsync(
        string topicName,
        string? downloadUrl,
        Guid documentId,
        GenerateQuizRequest request,
        string difficulty,
        IReadOnlyList<string>? existingQuestions = null)
    {
        var useDifficultyCounts = (request.NumEasyQuestions ?? 0) > 0
            || (request.NumMediumQuestions ?? 0) > 0
            || (request.NumHardQuestions ?? 0) > 0;

        // Luồng append truyền câu cũ để agent tránh sinh lại cùng nội dung.
        var response = await agent.GenerateQuizBatchAsync(
            topicName,
            null,
            downloadUrl,
            request.NumQuestions,
            useDifficultyCounts ? "mixed" : difficulty,
            useDifficultyCounts ? request.NumEasyQuestions ?? 0 : 0,
            useDifficultyCounts ? request.NumMediumQuestions ?? 0 : 0,
            useDifficultyCounts ? request.NumHardQuestions ?? 0 : 0,
            documentId: documentId.ToString(),
            existingQuestions: existingQuestions);

        return AgentQuizValidation.FilterQuestionsWithSingleCorrectOption(
            response?.Questions ?? [],
            logger);
    }

    private static Quiz BuildGeneratedQuiz(
        string titlePrefix,
        string type,
        Guid ownerId,
        Guid? classId,
        Guid? topicId,
        Guid sourceDocumentId,
        List<AgentQuizBatchQuestion> aiQuestions)
    {
        return new Quiz
        {
            Id = Guid.NewGuid(),
            Title = $"{titlePrefix} - [AI Generated] {DateTime.Now:dd/MM/yyyy HH:mm}",
            Type = type,
            IsPublished = false,
            CreatedAt = DateTime.UtcNow,
            ClassId = classId,
            TopicId = topicId,
            OwnerId = ownerId,
            Questions = aiQuestions
                .Select((question, index) => QuestionMapper.FromAgent(question, index, sourceDocumentId))
                .ToList()
        };
    }

    private static DocumentDto MapToDto(Document d) => new()
    {
        Id = d.Id.ToString(),
        OwnerId = d.OwnerId.ToString(),
        Name = d.FileName,
        Size = d.FileSize,
        Status = d.Status,
        UploadedAt = d.UploadedAt.ToString("yyyy-MM-dd"),
        TopicId = d.TopicId?.ToString(),
        GeneratedQuizId = d.GeneratedQuizId?.ToString(),
        ClassId = d.ClassId?.ToString(),
        Scope = d.Scope,
        IsVisible = d.IsVisible
    };

    public async Task<DocumentDto?> UpdateDocumentTopicAsync(Guid classId, Guid docId, string? topicId)
    {
        var doc = await db.Documents.FirstOrDefaultAsync(d => d.Id == docId && d.ClassId == classId && d.Scope == "class");
        if (doc == null) return null;

        if (string.IsNullOrWhiteSpace(topicId))
            doc.TopicId = null;
        else if (Guid.TryParse(topicId, out var tid))
            doc.TopicId = tid;

        await db.SaveChangesAsync();
        return MapToDto(doc);
    }

    public async Task<DocumentDto?> UpdateDocumentVisibilityAsync(Guid classId, Guid docId, bool isVisible)
    {
        var doc = await db.Documents.FirstOrDefaultAsync(d => d.Id == docId && d.ClassId == classId && d.Scope == "class");
        if (doc == null) return null;

        doc.IsVisible = isVisible;
        await db.SaveChangesAsync();
        return MapToDto(doc);
    }

    public async Task<List<string>> GetAllowedDocumentIdsAsync(Guid userId)
    {
        var user = await db.Users.FindAsync(userId);
        if (user == null) return [];

        var allowedDocIds = new List<string>();

        if (user.Role == "teacher")
        {
            // Teachers can see all documents in the classes they teach, and their own documents
            var classIds = await db.Classes
                .Where(c => c.TeacherId == userId)
                .Select(c => c.Id)
                .ToListAsync();

            var docs = await db.Documents
                .Where(d => (d.ClassId != null && classIds.Contains(d.ClassId.Value)) || d.OwnerId == userId)
                .Select(d => d.Id.ToString())
                .ToListAsync();

            allowedDocIds.AddRange(docs);
        }
        else // student
        {
            // 1. Private student documents owned by this student
            var privateDocs = await db.Documents
                .Where(d => d.OwnerId == userId && d.Scope == "student")
                .Select(d => d.Id.ToString())
                .ToListAsync();
            allowedDocIds.AddRange(privateDocs);

            // 2. Class documents for classes enrolled in and explicitly published by teacher
            var enrolledClassIds = await db.Enrollments
                .Where(e => e.StudentId == userId)
                .Select(e => e.ClassId)
                .ToListAsync();

            var classDocs = await db.Documents
                .Where(d => d.ClassId != null && enrolledClassIds.Contains(d.ClassId.Value) && d.IsVisible && d.Scope == "class")
                .Select(d => d.Id.ToString())
                .ToListAsync();
            allowedDocIds.AddRange(classDocs);
        }

        return allowedDocIds.Distinct().ToList();
    }
}
