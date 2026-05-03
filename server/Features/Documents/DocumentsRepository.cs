using EduBoost.API.Features.Documents.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Documents;

public interface IDocumentsRepository
{
    // Class documents
    Task<List<DocumentDto>> GetByClassIdAsync(Guid classId);
    Task<UploadUrlDto> RequestClassUploadUrlAsync(Guid classId, Guid teacherId, RequestUploadUrlRequest request);
    Task<DocumentDto?> ConfirmClassUploadAsync(Guid classId, Guid teacherId, string documentId);
    Task<bool> DeleteClassDocumentAsync(Guid classId, Guid docId);
    Task<GenerateQuizJobDto> GenerateQuizFromDocumentAsync(Guid classId, Guid docId, string? topicId);
    Task<DownloadUrlDto?> GetClassDocumentDownloadUrlAsync(Guid classId, Guid docId);

    // Student private documents
    Task<List<DocumentDto>> GetMyDocumentsAsync(Guid studentId);
    Task<UploadUrlDto> RequestStudentUploadUrlAsync(Guid studentId, RequestUploadUrlRequest request);
    Task<DocumentDto?> ConfirmStudentUploadAsync(Guid studentId, string documentId);
    Task<GenerateQuizJobDto> GenerateMyQuizAsync(Guid docId);
    Task<bool> DeleteMyDocumentAsync(Guid studentId, Guid docId);
    Task<DownloadUrlDto?> GetStudentDocumentDownloadUrlAsync(Guid studentId, Guid docId);

    Task<DocumentDto?> GetByIdAsync(Guid docId);
}

public class DocumentsRepository(AppDbContext db, IStorageService storage) : IDocumentsRepository
{
    private const string ClassBucket   = MinioStorageService.Buckets.ClassDocuments;
    private const string StudentBucket = MinioStorageService.Buckets.StudentDocuments;

    // ── Class documents ───────────────────────────────────────────────────────
    public async Task<List<DocumentDto>> GetByClassIdAsync(Guid classId)
    {
        return await db.Documents
            .Where(d => d.ClassId == classId)
            .OrderByDescending(d => d.UploadedAt)
            .Select(d => MapToDto(d))
            .ToListAsync();
    }

    public async Task<UploadUrlDto> RequestClassUploadUrlAsync(
        Guid classId, Guid teacherId, RequestUploadUrlRequest request)
    {
        await storage.EnsureBucketExistsAsync(ClassBucket);

        var docId     = Guid.NewGuid();
        var ext       = Path.GetExtension(request.FileName);
        var objectKey = $"class/{classId}/{docId}{ext}";

        // Create pending document record
        var doc = new Document
        {
            Id         = docId,
            OwnerId    = teacherId,
            ClassId    = classId,
            TopicId    = request.TopicId is null ? null : Guid.TryParse(request.TopicId, out var tid) ? tid : null,
            FileName   = request.FileName,
            FileSize   = request.FileSize,
            StorageKey = objectKey,
            Status     = "pending",
            Scope      = "class",
            UploadedAt = DateTime.UtcNow
        };

        db.Documents.Add(doc);
        await db.SaveChangesAsync();

        var uploadUrl = await storage.GetPresignedUploadUrlAsync(ClassBucket, objectKey, 600);

        return new UploadUrlDto
        {
            DocumentId      = docId.ToString(),
            UploadUrl       = uploadUrl,
            ExpiresInSeconds = 600
        };
    }

    public async Task<DocumentDto?> ConfirmClassUploadAsync(Guid classId, Guid teacherId, string documentId)
    {
        if (!Guid.TryParse(documentId, out var docId)) return null;

        var doc = await db.Documents
            .FirstOrDefaultAsync(d => d.Id == docId && d.ClassId == classId && d.OwnerId == teacherId);

        if (doc == null) return null;

        doc.Status = "ready";
        await db.SaveChangesAsync();
        return MapToDto(doc);
    }

    public async Task<bool> DeleteClassDocumentAsync(Guid classId, Guid docId)
    {
        var doc = await db.Documents
            .FirstOrDefaultAsync(d => d.Id == docId && d.ClassId == classId);

        if (doc == null) return false;

        if (doc.StorageKey != null)
            await storage.DeleteObjectAsync(ClassBucket, doc.StorageKey);

        db.Documents.Remove(doc);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<GenerateQuizJobDto> GenerateQuizFromDocumentAsync(Guid classId, Guid docId, string? topicId)
    {
        // AI integration placeholder — currently simulates processing
        var doc = await db.Documents.FindAsync(docId);
        if (doc != null) { doc.Status = "processing"; await db.SaveChangesAsync(); }

        return new GenerateQuizJobDto
        {
            JobId   = $"job-{Guid.NewGuid():N}",
            Status  = "processing",
            QuizId  = $"{Guid.NewGuid()}",
            Message = "AI đang phân tích tài liệu và tạo câu hỏi. Thường mất 30-60 giây."
        };
    }

    public async Task<DownloadUrlDto?> GetClassDocumentDownloadUrlAsync(Guid classId, Guid docId)
    {
        var doc = await db.Documents
            .FirstOrDefaultAsync(d => d.Id == docId && d.ClassId == classId);

        if (doc?.StorageKey == null) return null;

        var url = await storage.GetPresignedDownloadUrlAsync(ClassBucket, doc.StorageKey, 3600);
        return new DownloadUrlDto { DownloadUrl = url, ExpiresInSeconds = 3600 };
    }

    // ── Student private documents ──────────────────────────────────────────────
    public async Task<List<DocumentDto>> GetMyDocumentsAsync(Guid studentId)
    {
        return await db.Documents
            .Where(d => d.OwnerId == studentId && d.Scope == "student")
            .OrderByDescending(d => d.UploadedAt)
            .Select(d => MapToDto(d))
            .ToListAsync();
    }

    public async Task<UploadUrlDto> RequestStudentUploadUrlAsync(
        Guid studentId, RequestUploadUrlRequest request)
    {
        await storage.EnsureBucketExistsAsync(StudentBucket);

        var docId     = Guid.NewGuid();
        var ext       = Path.GetExtension(request.FileName);
        var objectKey = $"student/{studentId}/{docId}{ext}";

        var doc = new Document
        {
            Id         = docId,
            OwnerId    = studentId,
            FileName   = request.FileName,
            FileSize   = request.FileSize,
            StorageKey = objectKey,
            Status     = "pending",
            Scope      = "student",
            UploadedAt = DateTime.UtcNow
        };

        db.Documents.Add(doc);
        await db.SaveChangesAsync();

        var uploadUrl = await storage.GetPresignedUploadUrlAsync(StudentBucket, objectKey, 600);

        return new UploadUrlDto
        {
            DocumentId       = docId.ToString(),
            UploadUrl        = uploadUrl,
            ExpiresInSeconds = 600
        };
    }

    public async Task<DocumentDto?> ConfirmStudentUploadAsync(Guid studentId, string documentId)
    {
        if (!Guid.TryParse(documentId, out var docId)) return null;

        var doc = await db.Documents
            .FirstOrDefaultAsync(d => d.Id == docId && d.OwnerId == studentId && d.Scope == "student");

        if (doc == null) return null;

        doc.Status = "ready";
        await db.SaveChangesAsync();
        return MapToDto(doc);
    }

    public async Task<GenerateQuizJobDto> GenerateMyQuizAsync(Guid docId)
    {
        var doc = await db.Documents.FindAsync(docId);
        if (doc != null) { doc.Status = "processing"; await db.SaveChangesAsync(); }

        return new GenerateQuizJobDto
        {
            JobId   = $"job-{Guid.NewGuid():N}",
            Status  = "processing",
            QuizId  = $"{Guid.NewGuid()}",
            Message = "AI đang tạo quiz cho riêng bạn. Thường mất 30-60 giây."
        };
    }

    public async Task<bool> DeleteMyDocumentAsync(Guid studentId, Guid docId)
    {
        var doc = await db.Documents
            .FirstOrDefaultAsync(d => d.Id == docId && d.OwnerId == studentId && d.Scope == "student");

        if (doc == null) return false;

        if (doc.StorageKey != null)
            await storage.DeleteObjectAsync(StudentBucket, doc.StorageKey);

        db.Documents.Remove(doc);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<DownloadUrlDto?> GetStudentDocumentDownloadUrlAsync(Guid studentId, Guid docId)
    {
        var doc = await db.Documents
            .FirstOrDefaultAsync(d => d.Id == docId && d.OwnerId == studentId && d.Scope == "student");

        if (doc?.StorageKey == null) return null;

        var url = await storage.GetPresignedDownloadUrlAsync(StudentBucket, doc.StorageKey, 3600);
        return new DownloadUrlDto { DownloadUrl = url, ExpiresInSeconds = 3600 };
    }

    public async Task<DocumentDto?> GetByIdAsync(Guid docId)
    {
        var doc = await db.Documents.FindAsync(docId);
        return doc is null ? null : MapToDto(doc);
    }

    private static DocumentDto MapToDto(Document d) => new()
    {
        Id              = d.Id.ToString(),
        OwnerId         = d.OwnerId.ToString(),
        Name            = d.FileName,
        Size            = d.FileSize,
        Status          = d.Status,
        UploadedAt      = d.UploadedAt.ToString("yyyy-MM-dd"),
        TopicId         = d.TopicId?.ToString(),
        GeneratedQuizId = d.GeneratedQuizId?.ToString(),
        ClassId         = d.ClassId?.ToString(),
        Scope           = d.Scope
    };
}
