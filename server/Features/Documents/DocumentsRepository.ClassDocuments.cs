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

public partial class DocumentsRepository
{
    public async Task<List<DocumentDto>> GetByClassIdAsync(Guid classId, string? userRole = null)
    {
        var query = db.Documents.Where(d => d.ClassId == classId);
        if (string.Equals(userRole, "student", StringComparison.OrdinalIgnoreCase))
            query = query.Where(d => d.IsVisible);
        return await query
            .OrderByDescending(d => d.UploadedAt)
            .Select(d => MapToDto(d))
            .ToListAsync();
    }

    public async Task<UploadUrlDto> RequestClassUploadUrlAsync(
        Guid classId, Guid teacherId, RequestUploadUrlRequest request)
    {
        await storage.EnsureBucketExistsAsync(ClassBucket);

        var docId = Guid.NewGuid();
        var ext = Path.GetExtension(request.FileName);
        var objectKey = $"class/{classId}/{docId}{ext}";

        // Create pending document record
        var doc = new Document
        {
            Id = docId,
            OwnerId = teacherId,
            ClassId = classId,
            TopicId = request.TopicId is null ? null : Guid.TryParse(request.TopicId, out var tid) ? tid : null,
            FileName = request.FileName,
            FileSize = request.FileSize,
            StorageKey = objectKey,
            Status = "pending",
            Scope = "class",
            UploadedAt = DateTime.UtcNow
        };

        db.Documents.Add(doc);
        await db.SaveChangesAsync();

        var uploadUrl = await storage.GetPresignedUploadUrlAsync(ClassBucket, objectKey, 600);

        return new UploadUrlDto
        {
            DocumentId = docId.ToString(),
            UploadUrl = uploadUrl,
            ExpiresInSeconds = 600
        };
    }

    public async Task<DocumentDto?> ConfirmClassUploadAsync(Guid classId, Guid teacherId, string documentId)
    {
        if (!Guid.TryParse(documentId, out var docId)) return null;

        var doc = await db.Documents
            .FirstOrDefaultAsync(d => d.Id == docId && d.ClassId == classId && d.OwnerId == teacherId);

        if (doc == null) return null;

        doc.Status = "ingesting";
        await db.SaveChangesAsync();

        await ScheduleBackgroundIngest(
            doc.Id,
            documentScope: "class",
            classId: doc.ClassId?.ToString(),
            topicId: doc.TopicId?.ToString());

        return MapToDto(doc);
    }

    public async Task<bool> DeleteClassDocumentAsync(Guid classId, Guid docId)
    {
        var doc = await db.Documents
            .FirstOrDefaultAsync(d => d.Id == docId && d.ClassId == classId);

        if (doc == null) return false;

        try
        {
            await agent.DeleteDocumentAsync(docId.ToString());
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "RAG delete failed for class document {DocId}; removing from storage/DB anyway", docId);
        }

        if (doc.StorageKey != null)
            await storage.DeleteObjectAsync(ClassBucket, doc.StorageKey);

        db.Documents.Remove(doc);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<GenerateQuizJobDto> GenerateQuizFromDocumentAsync(Guid classId, Guid docId, GenerateQuizRequest request)
    {
        var jobId = $"job-{Guid.NewGuid():N}";
        var doc = await db.Documents.FirstOrDefaultAsync(d => d.Id == docId && d.ClassId == classId && d.Scope == "class");

        if (doc == null)
        {
            return new GenerateQuizJobDto
            {
                JobId = jobId,
                Status = "error",
                Message = "Không tìm thấy tài liệu lớp cần tạo quiz."
            };
        }

        try
        {
            doc.Status = "processing";
            await db.SaveChangesAsync();

            var (topicName, difficulty, resolvedTopicId) = await ResolveTopicContextAsync(request.TopicId, doc.TopicId, doc.FileName, request.Difficulty);
            var downloadUrl = await ResolveDocumentDownloadUrlAsync(doc);

            // Handle Append Mode
            if (request.Mode == "append" && doc.GeneratedQuizId != null)
            {
                var quiz = await db.Quizzes.Include(q => q.Questions).FirstOrDefaultAsync(q => q.Id == doc.GeneratedQuizId);
                if (quiz != null)
                {
                    var existingQuestions = quiz.Questions
                        .OrderByDescending(q => q.OrderIndex)
                        .Select(q => q.Text)
                        .Where(t => !string.IsNullOrWhiteSpace(t))
                        .Take(150)
                        .ToList();

                    var appendAiQuestions = await GenerateDocumentQuestionsAsync(
                        topicName, downloadUrl, doc.Id, request, difficulty, existingQuestions);

                    if (appendAiQuestions.Count == 0)
                    {
                        doc.Status = "ready"; // Reset to ready since the original quiz is still valid
                        await db.SaveChangesAsync();
                        return new GenerateQuizJobDto
                        {
                            JobId = jobId,
                            Status = "error",
                            Message = "AI không sinh thêm được câu hỏi hợp lệ từ tài liệu lớp."
                        };
                    }

                    var maxOrderIndex = quiz.Questions.Any() ? quiz.Questions.Max(q => q.OrderIndex) : -1;
                    foreach (var (questionData, index) in appendAiQuestions.Select((question, index) => (question, index)))
                    {
                        var question = QuestionMapper.FromAgent(
                            questionData,
                            maxOrderIndex + 1 + index,
                            doc.Id);
                        question.QuizId = quiz.Id;
                        db.Questions.Add(question);
                    }

                    doc.Status = "ready";
                    await db.SaveChangesAsync();

                    return new GenerateQuizJobDto
                    {
                        JobId = jobId,
                        Status = "completed",
                        QuizId = quiz.Id.ToString(),
                        Message = $"Đã sinh thêm {appendAiQuestions.Count} câu hỏi thành công từ tài liệu lớp."
                    };
                }
            }

            // Create Mode or Retry Mode (delete old quiz if it exists)
            if (doc.GeneratedQuizId != null)
            {
                var oldQuiz = await db.Quizzes.FindAsync(doc.GeneratedQuizId);
                if (oldQuiz != null)
                {
                    db.Quizzes.Remove(oldQuiz);
                }
                doc.GeneratedQuizId = null;
                await db.SaveChangesAsync();
            }

            var createAiQuestions = await GenerateDocumentQuestionsAsync(
                topicName, downloadUrl, doc.Id, request, difficulty);

            if (createAiQuestions.Count == 0)
            {
                doc.Status = "error";
                await db.SaveChangesAsync();

                return new GenerateQuizJobDto
                {
                    JobId = jobId,
                    Status = "error",
                    Message = "AI không sinh được câu hỏi hợp lệ từ tài liệu lớp."
                };
            }

            var newQuiz = BuildGeneratedQuiz(
                titlePrefix: topicName,
                type: "pool",
                ownerId: doc.OwnerId,
                classId: classId,
                topicId: resolvedTopicId,
                sourceDocumentId: doc.Id,
                aiQuestions: createAiQuestions);

            db.Quizzes.Add(newQuiz);
            doc.GeneratedQuizId = newQuiz.Id;
            doc.Status = "ready";
            await db.SaveChangesAsync();

            return new GenerateQuizJobDto
            {
                JobId = jobId,
                Status = "completed",
                QuizId = newQuiz.Id.ToString(),
                Message = "Đã tạo mới quiz thành công từ tài liệu lớp."
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "GenerateQuizFromDocument failed for class={ClassId}, doc={DocId}", classId, docId);

            try
            {
                db.ChangeTracker.Clear();
                var freshDoc = await db.Documents.FindAsync(docId);
                if (freshDoc != null)
                {
                    freshDoc.Status = "error";
                    await db.SaveChangesAsync();
                }
            }
            catch (Exception saveEx)
            {
                logger.LogError(saveEx, "Failed to set document status to error for doc={DocId}", docId);
            }

            return new GenerateQuizJobDto
            {
                JobId = jobId,
                Status = "error",
                Message = "Lỗi khi tạo quiz từ tài liệu lớp. Vui lòng thử lại."
            };
        }
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
}
