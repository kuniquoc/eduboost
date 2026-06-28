using EduBoost.API.Features.QuizPool;
using EduBoost.API.Features.QuizPool.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using EduBoost.API.Infrastructure.Integrations.Storage;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class PoolCreateEntryTestTests
{
    [Fact]
    public async Task CreateEntryTestFromPoolAsync_CopiesDifficultyAndSourceTopicId()
    {
        await using var db = CreateDb();
        var teacherId = Guid.NewGuid();
        var classId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var poolQuizId = Guid.NewGuid();
        var sourceQuestionId = Guid.NewGuid();

        db.Users.Add(new User { Id = teacherId, Name = "T", Email = "t@test.com", PasswordHash = "x", Role = "teacher" });
        db.Classes.Add(new Class { Id = classId, Name = "Lớp A", TeacherId = teacherId, ClassCode = "ABC12345", CreatedAt = DateTime.UtcNow });
        db.Topics.Add(new Topic { Id = topicId, Name = "Đại số", ClassId = classId, OwnerId = teacherId, Difficulty = "hard", CreatedAt = DateTime.UtcNow });
        db.Quizzes.Add(new Quiz { Id = poolQuizId, Title = "Pool batch", TopicId = topicId, Type = "pool", OwnerId = teacherId });
        db.Questions.Add(new Question
        {
            Id = sourceQuestionId,
            QuizId = poolQuizId,
            Text = "Câu hỏi pool",
            Type = "mcq",
            Difficulty = "hard",
            OrderIndex = 0,
            Options =
            [
                new QuizOption { Id = Guid.NewGuid(), Text = "A", IsCorrect = true, OrderIndex = 0 },
                new QuizOption { Id = Guid.NewGuid(), Text = "B", IsCorrect = false, OrderIndex = 1 }
            ]
        });
        await db.SaveChangesAsync();

        var repo = new PoolRepository(db, new NoOpStorage(), new FakeAgentService());
        var result = await repo.CreateEntryTestFromPoolAsync(teacherId, new CreateEntryTestFromPoolRequest
        {
            ClassId = classId.ToString(),
            QuestionIds = [sourceQuestionId.ToString()]
        });

        Assert.NotNull(result);
        Assert.Equal("entry_test", result.Type);
        Assert.Equal(classId.ToString(), result.ClassId);

        var entryQuiz = await db.Quizzes
            .Include(q => q.Questions)
            .SingleAsync(q => q.ClassId == classId && q.Type == "entry_test");

        var copied = entryQuiz.Questions.Single();
        Assert.Equal("hard", copied.Difficulty);
        Assert.Equal(topicId, copied.SourceTopicId);
        Assert.Equal("Câu hỏi pool", copied.Text);
    }

    [Fact]
    public async Task CreateEntryTestFromPoolAsync_ReturnsNull_WhenEntryTestAlreadyExists()
    {
        await using var db = CreateDb();
        var teacherId = Guid.NewGuid();
        var classId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var poolQuizId = Guid.NewGuid();

        db.Classes.Add(new Class { Id = classId, Name = "Lớp B", TeacherId = teacherId, ClassCode = "XYZ12345", CreatedAt = DateTime.UtcNow });
        db.Quizzes.AddRange(
            new Quiz { Id = Guid.NewGuid(), ClassId = classId, Title = "Existing entry", Type = "entry_test", OwnerId = teacherId },
            new Quiz { Id = poolQuizId, Title = "Pool", TopicId = topicId, Type = "pool", OwnerId = teacherId });
        db.Topics.Add(new Topic { Id = topicId, Name = "Topic", ClassId = classId, OwnerId = teacherId, Difficulty = "medium", CreatedAt = DateTime.UtcNow });
        db.Questions.Add(CreateMcq(Guid.NewGuid(), poolQuizId, "Q1"));
        await db.SaveChangesAsync();

        var repo = new PoolRepository(db, new NoOpStorage(), new FakeAgentService());
        var result = await repo.CreateEntryTestFromPoolAsync(teacherId, new CreateEntryTestFromPoolRequest
        {
            ClassId = classId.ToString(),
            PoolQuizIds = [poolQuizId.ToString()]
        });

        Assert.Null(result);
        Assert.Equal(1, await db.Quizzes.CountAsync(q => q.ClassId == classId && q.Type == "entry_test"));
    }

    [Fact]
    public async Task CreateTestFromPoolAsync_SetsSourceTopicId()
    {
        await using var db = CreateDb();
        var teacherId = Guid.NewGuid();
        var classId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var poolQuizId = Guid.NewGuid();

        db.Classes.Add(new Class { Id = classId, Name = "Lớp C", TeacherId = teacherId, ClassCode = "DEF12345", CreatedAt = DateTime.UtcNow });
        db.Topics.Add(new Topic { Id = topicId, Name = "Hình học", ClassId = classId, OwnerId = teacherId, Difficulty = "medium", CreatedAt = DateTime.UtcNow });
        db.Quizzes.Add(new Quiz { Id = poolQuizId, Title = "Pool batch", TopicId = topicId, Type = "pool", OwnerId = teacherId });
        db.Questions.Add(CreateMcq(Guid.NewGuid(), poolQuizId, "Q1", "medium"));
        await db.SaveChangesAsync();

        var repo = new PoolRepository(db, new NoOpStorage(), new FakeAgentService());
        await repo.CreateTestFromPoolAsync(teacherId, new CreateTestFromPoolRequest
        {
            Title = "Practice test",
            ClassId = classId.ToString(),
            PoolQuizIds = [poolQuizId.ToString()]
        });

        var practiceQuiz = await db.Quizzes
            .Include(q => q.Questions)
            .SingleAsync(q => q.ClassId == classId && q.Type == "practice");

        Assert.Equal(topicId, practiceQuiz.Questions.Single().SourceTopicId);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static Question CreateMcq(Guid id, Guid quizId, string text, string difficulty = "easy") => new()
    {
        Id = id,
        QuizId = quizId,
        Text = text,
        Type = "mcq",
        Difficulty = difficulty,
        OrderIndex = 0,
        Options =
        [
            new QuizOption { Id = Guid.NewGuid(), Text = "A", IsCorrect = true, OrderIndex = 0 },
            new QuizOption { Id = Guid.NewGuid(), Text = "B", IsCorrect = false, OrderIndex = 1 }
        ]
    };

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
            => Task.FromResult<AgentQuizBatchResponse?>(null);

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
