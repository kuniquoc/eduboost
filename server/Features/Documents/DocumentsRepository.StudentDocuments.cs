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

        var docId = Guid.NewGuid();
        var ext = Path.GetExtension(request.FileName);
        var objectKey = $"student/{studentId}/{docId}{ext}";

        var doc = new Document
        {
            Id = docId,
            OwnerId = studentId,
            FileName = request.FileName,
            FileSize = request.FileSize,
            StorageKey = objectKey,
            Status = "pending",
            Scope = "student",
            UploadedAt = DateTime.UtcNow
        };

        db.Documents.Add(doc);
        await db.SaveChangesAsync();

        var uploadUrl = await storage.GetPresignedUploadUrlAsync(StudentBucket, objectKey, 600);

        return new UploadUrlDto
        {
            DocumentId = docId.ToString(),
            UploadUrl = uploadUrl,
            ExpiresInSeconds = 600
        };
    }

    public async Task<DocumentDto?> ConfirmStudentUploadAsync(Guid studentId, string documentId)
    {
        if (!Guid.TryParse(documentId, out var docId)) return null;

        var doc = await db.Documents
            .FirstOrDefaultAsync(d => d.Id == docId && d.OwnerId == studentId && d.Scope == "student");

        if (doc == null) return null;

        doc.Status = "ingesting";
        await db.SaveChangesAsync();

        await ScheduleBackgroundIngest(
            doc.Id,
            documentScope: "student",
            ownerId: doc.OwnerId.ToString());

        return MapToDto(doc);
    }

    public async Task<GenerateQuizJobDto> GenerateMyQuizAsync(Guid studentId, Guid docId, GenerateQuizRequest request)
    {
        var jobId = $"job-{Guid.NewGuid():N}";
        var doc = await db.Documents.FirstOrDefaultAsync(d => d.Id == docId && d.Scope == "student" && d.OwnerId == studentId);

        if (doc == null)
        {
            return new GenerateQuizJobDto
            {
                JobId = jobId,
                Status = "error",
                Message = "Không tìm thấy tài liệu cá nhân cần tạo quiz."
            };
        }

        try
        {
            doc.Status = "processing";
            await db.SaveChangesAsync();

            var (topicName, topicId) = await ResolveOrCreateStudentTopicFromDocumentAsync(
                studentId, doc, request.Difficulty);
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

                    var studentAppendAiQuestions = await GenerateDocumentQuestionsAsync(
                        topicName, downloadUrl, doc.Id, request, request.Difficulty, existingQuestions);

                    if (studentAppendAiQuestions.Count == 0)
                    {
                        doc.Status = "ready"; // Reset to ready since the original quiz is still valid
                        await db.SaveChangesAsync();
                        return new GenerateQuizJobDto
                        {
                            JobId = jobId,
                            Status = "error",
                            Message = "AI không sinh thêm được câu hỏi hợp lệ từ tài liệu cá nhân."
                        };
                    }

                    if (quiz.TopicId != topicId || quiz.Type != "pool")
                    {
                        quiz.TopicId = topicId;
                        quiz.Type = "pool";
                    }

                    var maxOrderIndex = quiz.Questions.Any() ? quiz.Questions.Max(q => q.OrderIndex) : -1;
                    foreach (var (questionData, index) in studentAppendAiQuestions.Select((question, index) => (question, index)))
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
                        TopicName = topicName,
                        Message = $"Đã sinh thêm {studentAppendAiQuestions.Count} câu vào Kho Pool — chủ đề: {topicName}."
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

            var studentCreateAiQuestions = await GenerateDocumentQuestionsAsync(
                topicName, downloadUrl, doc.Id, request, request.Difficulty);

            if (studentCreateAiQuestions.Count == 0)
            {
                doc.Status = "error";
                await db.SaveChangesAsync();

                return new GenerateQuizJobDto
                {
                    JobId = jobId,
                    Status = "error",
                    Message = "AI không sinh được câu hỏi hợp lệ từ tài liệu cá nhân."
                };
            }

            var newQuiz = BuildGeneratedQuiz(
                titlePrefix: topicName,
                type: "pool",
                ownerId: doc.OwnerId,
                classId: null,
                topicId: topicId,
                sourceDocumentId: doc.Id,
                aiQuestions: studentCreateAiQuestions);

            db.Quizzes.Add(newQuiz);
            doc.GeneratedQuizId = newQuiz.Id;
            doc.Status = "ready";
            await db.SaveChangesAsync();

            return new GenerateQuizJobDto
            {
                JobId = jobId,
                Status = "completed",
                QuizId = newQuiz.Id.ToString(),
                TopicName = topicName,
                Message = $"Đã tạo {studentCreateAiQuestions.Count} câu vào Kho Pool — chủ đề: {topicName}."
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "GenerateMyQuiz failed for doc={DocId}", docId);

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
                Message = "Lỗi khi tạo quiz cá nhân. Vui lòng thử lại."
            };
        }
    }

    public async Task<bool> DeleteMyDocumentAsync(Guid studentId, Guid docId)
    {
        var doc = await db.Documents
            .FirstOrDefaultAsync(d => d.Id == docId && d.OwnerId == studentId && d.Scope == "student");

        if (doc == null) return false;

        try
        {
            await agent.DeleteDocumentAsync(docId.ToString());
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "RAG delete failed for student document {DocId}; removing from storage/DB anyway", docId);
        }

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

}
