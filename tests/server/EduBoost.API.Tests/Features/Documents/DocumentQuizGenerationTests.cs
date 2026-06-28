using EduBoost.API.Features.Documents;
using EduBoost.API.Features.Documents.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using EduBoost.API.Infrastructure.Integrations.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EduBoost.API.Tests;

public class DocumentQuizGenerationTests
{
    [Fact]
    public async Task GenerateMyQuiz_CreateThenAppend_PreservesQuizAndSendsExistingQuestions()
    {
        await using var db = CreateDb();
        var studentId = Guid.NewGuid();
        var document = new Document
        {
            Id = Guid.NewGuid(),
            OwnerId = studentId,
            FileName = "present-simple.pdf",
            FileSize = "1024",
            StorageKey = "student/file.pdf",
            Scope = "student",
            Status = "ready"
        };
        db.Documents.Add(document);
        await db.SaveChangesAsync();

        var agent = new FakeAgentService();
        var repository = new DocumentsRepository(
            db,
            new NoOpStorage(),
            agent,
            NullLogger<DocumentsRepository>.Instance,
            new NoOpIngestQueue());

        var created = await repository.GenerateMyQuizAsync(studentId, document.Id, new GenerateQuizRequest
        {
            NumQuestions = 1,
            Difficulty = "medium",
            Mode = "create"
        });
        var firstQuizId = Guid.Parse(created.QuizId!);

        var appended = await repository.GenerateMyQuizAsync(studentId, document.Id, new GenerateQuizRequest
        {
            NumQuestions = 1,
            Difficulty = "medium",
            Mode = "append"
        });

        Assert.Equal("completed", created.Status);
        Assert.Equal(firstQuizId.ToString(), appended.QuizId);
        Assert.Contains("Câu hỏi số 1", agent.LastExistingQuestions ?? []);
        Assert.Equal(2, await db.Questions.CountAsync(question => question.QuizId == firstQuizId));
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private sealed class NoOpIngestQueue : IDocumentIngestQueue
    {
        public ValueTask EnqueueAsync(DocumentIngestJob job, CancellationToken cancellationToken = default) =>
            ValueTask.CompletedTask;
    }

    private sealed class NoOpStorage : IStorageService
    {
        public Task<string> GetPresignedUploadUrlAsync(string bucket, string objectKey, int expirySeconds = 600) => Task.FromResult("upload");
        public Task<string> GetPresignedDownloadUrlAsync(string bucket, string objectKey, int expirySeconds = 3600) => Task.FromResult("download");
        public Task<string> GetInternalPresignedDownloadUrlAsync(string bucket, string objectKey, int expirySeconds = 3600) => Task.FromResult("http://agent/document.pdf");
        public Task DeleteObjectAsync(string bucket, string objectKey) => Task.CompletedTask;
        public Task EnsureBucketExistsAsync(string bucket) => Task.CompletedTask;
        public Task UploadObjectAsync(string bucket, string objectKey, Stream dataStream, string contentType) => Task.CompletedTask;
    }

    private sealed class FakeAgentService : IAgentService
    {
        private int _callCount;
        public IReadOnlyList<string>? LastExistingQuestions { get; private set; }

        public Task<AgentQuizBatchResponse?> GenerateQuizBatchAsync(
            string topicName,
            string? userPrompt,
            string? docUrl,
            int numQuestions,
            string difficulty,
            int numEasy = 0,
            int numMedium = 0,
            int numHard = 0,
            string? documentId = null,
            IReadOnlyList<string>? existingQuestions = null)
        {
            _callCount++;
            LastExistingQuestions = existingQuestions;
            return Task.FromResult<AgentQuizBatchResponse?>(new AgentQuizBatchResponse
            {
                Questions =
                [
                    new AgentQuizBatchQuestion
                    {
                        Question = $"Câu hỏi số {_callCount}",
                        Difficulty = difficulty,
                        Options =
                        [
                            new AgentQuizBatchOption { Text = "Đúng", IsCorrect = true },
                            new AgentQuizBatchOption { Text = "Sai", IsCorrect = false }
                        ]
                    }
                ]
            });
        }

        public Task<AgentNextActionResponse?> GetNextActionAsync(string studentId, string topicName, double? masteryProbability = null, double? irtTheta = null) => Task.FromResult<AgentNextActionResponse?>(null);
        public Task<AgentQuizResponse?> GenerateQuizQuestionAsync(string topicName, double difficulty, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null, IReadOnlyList<string>? existingQuestions = null) => Task.FromResult<AgentQuizResponse?>(null);
        public Task<string?> GetExplanationAsync(string topicName, string studentState, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null) => Task.FromResult<string?>(null);
        public Task<string?> GetGraderExplanationAsync(string question, string correctAnswer, IReadOnlyList<AgentGraderOption>? options = null, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null) => Task.FromResult<string?>(null);
        public Task<AgentChatResponse> AskAsync(string question, string? topicId, string level, List<ChatMessage> history, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null) => Task.FromResult(new AgentChatResponse());
        public Task IngestDocumentAsync(string documentId, string fileUrl, string scope, string? classId = null, string? ownerId = null, string? topicId = null) => Task.CompletedTask;
        public Task DeleteDocumentAsync(string documentId) => Task.CompletedTask;
    }
}
