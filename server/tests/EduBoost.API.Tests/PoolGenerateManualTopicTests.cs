using EduBoost.API.Features.QuizPool;
using EduBoost.API.Features.QuizPool.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Services;
using EduBoost.API.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class PoolGenerateManualTopicTests
{
    [Fact]
    public async Task GeneratePoolQuizAsync_WithTopicId_UsesExistingClassTopic()
    {
        await using var db = CreateDb();
        var teacherId = Guid.NewGuid();
        var classId = Guid.NewGuid();
        var topicId = Guid.NewGuid();

        db.Users.Add(new User { Id = teacherId, Name = "T", Email = "t@test.com", PasswordHash = "x", Role = "teacher" });
        db.Classes.Add(new Class { Id = classId, Name = "C1", TeacherId = teacherId, ClassCode = "ABC12345", CreatedAt = DateTime.UtcNow });
        db.Topics.Add(new Topic
        {
            Id = topicId,
            Name = "Đại số",
            ClassId = classId,
            OwnerId = teacherId,
            Difficulty = "hard",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var repo = new PoolRepository(db, new NoOpStorage(), new FakeAgentService());
        var request = new GeneratePoolQuizRequest
        {
            TopicId = topicId.ToString(),
            ClassId = classId.ToString(),
            UserSuggestion = "Tạo câu hỏi về phương trình bậc hai",
            NumQuestions = 3,
            Difficulty = "medium"
        };

        var quiz = await repo.GeneratePoolQuizAsync(teacherId, "teacher", request);

        Assert.NotNull(quiz);
        Assert.Equal(topicId.ToString(), quiz.TopicId);
        Assert.Equal(classId.ToString(), quiz.ClassId);
        Assert.Equal(1, await db.Quizzes.CountAsync(q => q.TopicId == topicId && q.Type == "pool"));
    }

    [Fact]
    public async Task GeneratePoolQuizAsync_WithUnknownTopicId_ReturnsNull()
    {
        await using var db = CreateDb();
        var repo = new PoolRepository(db, new NoOpStorage(), new FakeAgentService());
        var request = new GeneratePoolQuizRequest
        {
            TopicId = Guid.NewGuid().ToString(),
            UserSuggestion = "Gợi ý nội dung",
            NumQuestions = 3
        };

        var quiz = await repo.GeneratePoolQuizAsync(Guid.NewGuid(), "teacher", request);

        Assert.Null(quiz);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private sealed class NoOpStorage : IStorageService
    {
        public Task<string> GetPresignedUploadUrlAsync(string bucket, string objectKey, int expirySeconds = 600) => Task.FromResult("");
        public Task<string> GetPresignedDownloadUrlAsync(string bucket, string objectKey, int expirySeconds = 3600) => Task.FromResult("");
        public Task<string> GetInternalPresignedDownloadUrlAsync(string bucket, string objectKey, int expirySeconds = 3600) => Task.FromResult("");
        public Task DeleteObjectAsync(string bucket, string objectKey) => Task.CompletedTask;
        public Task EnsureBucketExistsAsync(string bucket) => Task.CompletedTask;
        public Task UploadObjectAsync(string bucket, string objectKey, Stream dataStream, string contentType) => Task.CompletedTask;
    }

    private sealed class FakeAgentService : IAgentService
    {
        public Task<AgentNextActionResponse?> GetNextActionAsync(string studentId, string topicName, double? masteryProbability = null, double? irtTheta = null)
            => Task.FromResult<AgentNextActionResponse?>(null);

        public Task<AgentQuizBatchResponse?> GenerateQuizBatchAsync(
            string topicName, string? userPrompt, string? docUrl, int numQuestions, string difficulty,
            int numEasy = 0, int numMedium = 0, int numHard = 0, string? documentId = null,
            IReadOnlyList<string>? existingQuestions = null)
        {
            return Task.FromResult<AgentQuizBatchResponse?>(new AgentQuizBatchResponse
            {
                Questions =
                [
                    new AgentQuizBatchQuestion
                    {
                        Question = $"Câu hỏi về {topicName}?",
                        Type = "mcq",
                        Difficulty = difficulty,
                        Explanation = "Giải thích mẫu",
                        Options =
                        [
                            new AgentQuizBatchOption { Text = "A", IsCorrect = false },
                            new AgentQuizBatchOption { Text = "B", IsCorrect = true },
                            new AgentQuizBatchOption { Text = "C", IsCorrect = false },
                            new AgentQuizBatchOption { Text = "D", IsCorrect = false },
                        ]
                    }
                ]
            });
        }

        public Task<AgentQuizResponse?> GenerateQuizQuestionAsync(string topicName, double difficulty, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null, IReadOnlyList<string>? existingQuestions = null)
            => Task.FromResult<AgentQuizResponse?>(null);

        public Task<string?> GetExplanationAsync(string topicName, string studentState, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null)
            => Task.FromResult<string?>(null);

        public Task<string?> GetGraderExplanationAsync(string question, string correctAnswer, IReadOnlyList<AgentGraderOption>? options = null, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null)
            => Task.FromResult<string?>(null);

        public Task<AgentChatResponse> AskAsync(string question, string? topicId, string level, List<ChatMessage> history, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null)
            => Task.FromResult(new AgentChatResponse());

        public Task IngestDocumentAsync(string documentId, string fileUrl, string scope, string? classId = null, string? ownerId = null, string? topicId = null)
            => Task.CompletedTask;

        public Task DeleteDocumentAsync(string documentId) => Task.CompletedTask;
    }
}
