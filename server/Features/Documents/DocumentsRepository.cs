using EduBoost.API.Features.Documents.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Services;
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
}

public class DocumentsRepository(
    AppDbContext db,
    IStorageService storage,
    IAgentService agent,
    ILogger<DocumentsRepository> logger) : IDocumentsRepository
{
    private const string ClassBucket = MinioStorageService.Buckets.ClassDocuments;
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

        doc.Status = "ready";
        await db.SaveChangesAsync();

        // Trigger RAG Ingestion in the background to avoid blocking the main confirm workflow
        _ = Task.Run(async () =>
        {
            try
            {
                var downloadUrl = await ResolveDocumentDownloadUrlAsync(doc);
                if (downloadUrl != null)
                {
                    await agent.IngestDocumentAsync(
                        documentId: doc.Id.ToString(),
                        fileUrl: downloadUrl,
                        scope: "class",
                        classId: doc.ClassId?.ToString(),
                        topicId: doc.TopicId?.ToString()
                    );
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to background-ingest class document {DocId}", doc.Id);
            }
        });

        return MapToDto(doc);
    }

    public async Task<bool> DeleteClassDocumentAsync(Guid classId, Guid docId)
    {
        var doc = await db.Documents
            .FirstOrDefaultAsync(d => d.Id == docId && d.ClassId == classId);

        if (doc == null) return false;

        if (doc.StorageKey != null)
            await storage.DeleteObjectAsync(ClassBucket, doc.StorageKey);

        // Call RAG delete
        _ = Task.Run(async () =>
        {
            try
            {
                await agent.DeleteDocumentAsync(docId.ToString());
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to background-delete class document {DocId} in Python RAG", docId);
            }
        });

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
                    var appendAiQuestions = new List<AgentQuizBatchQuestion>();
                    bool isAdvanced = (request.NumEasyQuestions ?? 0) > 0 || 
                                      (request.NumMediumQuestions ?? 0) > 0 || 
                                      (request.NumHardQuestions ?? 0) > 0;
                                      
                    if (isAdvanced)
                    {
                        var res = await agent.GenerateQuizBatchAsync(
                            topicName, 
                            null, 
                            downloadUrl, 
                            request.NumQuestions, 
                            "mixed", 
                            request.NumEasyQuestions ?? 0, 
                            request.NumMediumQuestions ?? 0, 
                            request.NumHardQuestions ?? 0);
                        if (res?.Questions != null) appendAiQuestions.AddRange(res.Questions);
                    }
                    else
                    {
                        var res = await agent.GenerateQuizBatchAsync(topicName, null, downloadUrl, request.NumQuestions, difficulty);
                        if (res?.Questions != null) appendAiQuestions.AddRange(res.Questions);
                    }

                    if (appendAiQuestions.Count == 0)
                    {
                        doc.Status = "ready"; // Reset to ready since the original quiz is still valid
                        await db.SaveChangesAsync();
                        return new GenerateQuizJobDto
                        {
                            JobId = jobId,
                            Status = "error",
                            Message = "AI không sinh thêm được câu hỏi từ tài liệu lớp."
                        };
                    }

                    var maxOrderIndex = quiz.Questions.Any() ? quiz.Questions.Max(q => q.OrderIndex) : -1;
                    foreach (var (q, idx) in appendAiQuestions.Select((q, idx) => (q, idx)))
                    {
                        var question = new Question
                        {
                            Id = Guid.NewGuid(),
                            QuizId = quiz.Id,
                            SourceDocumentId = doc.Id,
                            Text = q.Question,
                            Type = string.IsNullOrWhiteSpace(q.Type) ? "mcq" : q.Type,
                            Difficulty = string.IsNullOrWhiteSpace(q.Difficulty) ? "medium" : q.Difficulty,
                            Explanation = q.Explanation,
                            CorrectAnswer = q.Options.FirstOrDefault(o => o.IsCorrect)?.Text ?? "",
                            VerifiedByTeacher = false,
                            OrderIndex = maxOrderIndex + 1 + idx,
                            Options = q.Options.Select((o, oidx) => new QuizOption
                            {
                                Id = Guid.NewGuid(),
                                Text = o.Text,
                                IsCorrect = o.IsCorrect,
                                OrderIndex = oidx
                            }).ToList()
                        };
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

            var createAiQuestions = new List<AgentQuizBatchQuestion>();
            bool isCreateAdvanced = (request.NumEasyQuestions ?? 0) > 0 || 
                                    (request.NumMediumQuestions ?? 0) > 0 || 
                                    (request.NumHardQuestions ?? 0) > 0;
                                    
            if (isCreateAdvanced)
            {
                var res = await agent.GenerateQuizBatchAsync(
                    topicName, 
                    null, 
                    downloadUrl, 
                    request.NumQuestions, 
                    "mixed", 
                    request.NumEasyQuestions ?? 0, 
                    request.NumMediumQuestions ?? 0, 
                    request.NumHardQuestions ?? 0);
                if (res?.Questions != null) createAiQuestions.AddRange(res.Questions);
            }
            else
            {
                var res = await agent.GenerateQuizBatchAsync(topicName, null, downloadUrl, request.NumQuestions, difficulty);
                if (res?.Questions != null) createAiQuestions.AddRange(res.Questions);
            }

            if (createAiQuestions.Count == 0)
            {
                doc.Status = "error";
                await db.SaveChangesAsync();

                return new GenerateQuizJobDto
                {
                    JobId = jobId,
                    Status = "error",
                    Message = "AI không sinh được câu hỏi từ tài liệu lớp."
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

        doc.Status = "ready";
        await db.SaveChangesAsync();

        // Trigger RAG Ingestion in the background
        _ = Task.Run(async () =>
        {
            try
            {
                var downloadUrl = await ResolveDocumentDownloadUrlAsync(doc);
                if (downloadUrl != null)
                {
                    await agent.IngestDocumentAsync(
                        documentId: doc.Id.ToString(),
                        fileUrl: downloadUrl,
                        scope: "student",
                        ownerId: doc.OwnerId.ToString()
                    );
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to background-ingest student document {DocId}", doc.Id);
            }
        });

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

            var inferredTopic = Path.GetFileNameWithoutExtension(doc.FileName);
            var topicName = string.IsNullOrWhiteSpace(inferredTopic) ? "Ôn tập cá nhân" : inferredTopic;
            var downloadUrl = await ResolveDocumentDownloadUrlAsync(doc);

            // Handle Append Mode
            if (request.Mode == "append" && doc.GeneratedQuizId != null)
            {
                var quiz = await db.Quizzes.Include(q => q.Questions).FirstOrDefaultAsync(q => q.Id == doc.GeneratedQuizId);
                if (quiz != null)
                {
                    var studentAppendAiQuestions = new List<AgentQuizBatchQuestion>();
                    bool isStudentAppendAdvanced = (request.NumEasyQuestions ?? 0) > 0 || 
                                                 (request.NumMediumQuestions ?? 0) > 0 || 
                                                 (request.NumHardQuestions ?? 0) > 0;
                                                 
                    if (isStudentAppendAdvanced)
                    {
                        var res = await agent.GenerateQuizBatchAsync(
                            topicName, 
                            null, 
                            downloadUrl, 
                            request.NumQuestions, 
                            "mixed", 
                            request.NumEasyQuestions ?? 0, 
                            request.NumMediumQuestions ?? 0, 
                            request.NumHardQuestions ?? 0);
                        if (res?.Questions != null) studentAppendAiQuestions.AddRange(res.Questions);
                    }
                    else
                    {
                        var res = await agent.GenerateQuizBatchAsync(topicName, null, downloadUrl, request.NumQuestions, request.Difficulty);
                        if (res?.Questions != null) studentAppendAiQuestions.AddRange(res.Questions);
                    }

                    if (studentAppendAiQuestions.Count == 0)
                    {
                        doc.Status = "ready"; // Reset to ready since the original quiz is still valid
                        await db.SaveChangesAsync();
                        return new GenerateQuizJobDto
                        {
                            JobId = jobId,
                            Status = "error",
                            Message = "AI không sinh thêm được câu hỏi từ tài liệu cá nhân."
                        };
                    }

                    var maxOrderIndex = quiz.Questions.Any() ? quiz.Questions.Max(q => q.OrderIndex) : -1;
                    foreach (var (q, idx) in studentAppendAiQuestions.Select((q, idx) => (q, idx)))
                    {
                        var question = new Question
                        {
                            Id = Guid.NewGuid(),
                            QuizId = quiz.Id,
                            SourceDocumentId = doc.Id,
                            Text = q.Question,
                            Type = string.IsNullOrWhiteSpace(q.Type) ? "mcq" : q.Type,
                            Difficulty = string.IsNullOrWhiteSpace(q.Difficulty) ? "medium" : q.Difficulty,
                            Explanation = q.Explanation,
                            CorrectAnswer = q.Options.FirstOrDefault(o => o.IsCorrect)?.Text ?? "",
                            VerifiedByTeacher = false,
                            OrderIndex = maxOrderIndex + 1 + idx,
                            Options = q.Options.Select((o, oidx) => new QuizOption
                            {
                                Id = Guid.NewGuid(),
                                Text = o.Text,
                                IsCorrect = o.IsCorrect,
                                OrderIndex = oidx
                            }).ToList()
                        };
                        db.Questions.Add(question);
                    }

                    doc.Status = "ready";
                    await db.SaveChangesAsync();

                    return new GenerateQuizJobDto
                    {
                        JobId = jobId,
                        Status = "completed",
                        QuizId = quiz.Id.ToString(),
                        Message = $"Đã sinh thêm {studentAppendAiQuestions.Count} câu hỏi thành công từ tài liệu cá nhân."
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

            var studentCreateAiQuestions = new List<AgentQuizBatchQuestion>();
            bool isStudentCreateAdvanced = (request.NumEasyQuestions ?? 0) > 0 || 
                                           (request.NumMediumQuestions ?? 0) > 0 || 
                                           (request.NumHardQuestions ?? 0) > 0;
                                           
            if (isStudentCreateAdvanced)
            {
                var res = await agent.GenerateQuizBatchAsync(
                    topicName, 
                    null, 
                    downloadUrl, 
                    request.NumQuestions, 
                    "mixed", 
                    request.NumEasyQuestions ?? 0, 
                    request.NumMediumQuestions ?? 0, 
                    request.NumHardQuestions ?? 0);
                if (res?.Questions != null) studentCreateAiQuestions.AddRange(res.Questions);
            }
            else
            {
                var res = await agent.GenerateQuizBatchAsync(topicName, null, downloadUrl, request.NumQuestions, request.Difficulty);
                if (res?.Questions != null) studentCreateAiQuestions.AddRange(res.Questions);
            }

            if (studentCreateAiQuestions.Count == 0)
            {
                doc.Status = "error";
                await db.SaveChangesAsync();

                return new GenerateQuizJobDto
                {
                    JobId = jobId,
                    Status = "error",
                    Message = "AI không sinh được câu hỏi từ tài liệu cá nhân."
                };
            }

            var newQuiz = BuildGeneratedQuiz(
                titlePrefix: topicName,
                type: "private",
                ownerId: doc.OwnerId,
                classId: null,
                topicId: null,
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
                Message = "Đã tạo mới quiz cá nhân thành công."
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

        if (doc.StorageKey != null)
            await storage.DeleteObjectAsync(StudentBucket, doc.StorageKey);

        // Call RAG delete in background
        _ = Task.Run(async () =>
        {
            try
            {
                await agent.DeleteDocumentAsync(docId.ToString());
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to background-delete student document {DocId} in Python RAG", docId);
            }
        });

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

    private async Task<string?> ResolveDocumentDownloadUrlAsync(Document doc)
    {
        if (doc.StorageKey == null) return null;

        var bucket = doc.Scope == "student" ? StudentBucket : ClassBucket;
        return await storage.GetPresignedDownloadUrlAsync(bucket, doc.StorageKey, 3600);
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
            Questions = aiQuestions.Select((q, qidx) => new Question
            {
                Id = Guid.NewGuid(),
                SourceDocumentId = sourceDocumentId,
                Text = q.Question,
                Type = string.IsNullOrWhiteSpace(q.Type) ? "mcq" : q.Type,
                Difficulty = string.IsNullOrWhiteSpace(q.Difficulty) ? "medium" : q.Difficulty,
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
        Scope = d.Scope
    };

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

            // 2. Class documents for classes enrolled in and linked to published topics
            var enrolledClassIds = await db.Enrollments
                .Where(e => e.StudentId == userId)
                .Select(e => e.ClassId)
                .ToListAsync();

            var visibleTopicIds = await db.Topics
                .Where(t => t.ClassId != null && enrolledClassIds.Contains(t.ClassId.Value) && t.IsDocumentVisible)
                .Select(t => t.Id)
                .ToListAsync();

            var classDocs = await db.Documents
                .Where(d => d.ClassId != null && enrolledClassIds.Contains(d.ClassId.Value) && d.TopicId != null && visibleTopicIds.Contains(d.TopicId.Value) && d.Scope == "class")
                .Select(d => d.Id.ToString())
                .ToListAsync();
            allowedDocIds.AddRange(classDocs);
        }

        return allowedDocIds.Distinct().ToList();
    }
}
