using EduBoost.API.Features.Admin;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Integrations.Agent;
using EduBoost.API.Infrastructure.Integrations.Storage;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EduBoost.API.Tests.Features.Admin;

public class AdminUserDeletionTests
{
    [Fact]
    public async Task DeleteStudent_CascadesSubmissionTokensAndProfile_ButKeepsQuiz()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var db = database.Context;
        var admin = User("admin");
        var teacher = User("teacher");
        var student = User("student");
        var item = new IrtItem { Id = Guid.NewGuid(), Beta = 0 };
        var quiz = new Quiz { Id = Guid.NewGuid(), Title = "Quiz", OwnerId = teacher.Id };
        var question = new Question
        {
            Id = Guid.NewGuid(), Text = "Question", Quiz = quiz, IrtItem = item
        };

        db.AddRange(admin, teacher, student, item, quiz, question);
        db.QuizSubmissions.Add(new QuizSubmission
        {
            Id = Guid.NewGuid(), StudentId = student.Id, Quiz = quiz, TotalQuestions = 1
        });
        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(), UserId = student.Id, Token = "student-token", ExpiresAt = DateTime.UtcNow.AddDays(1)
        });
        db.UserProfiles.Add(new UserProfile { Id = Guid.NewGuid(), UserId = student.Id });
        await db.SaveChangesAsync();

        var result = await Repository(db).DeleteUserAsync(student.Id, admin.Id);

        Assert.Equal(DeleteUserResult.Deleted, result);
        Assert.False(await db.Users.AnyAsync(u => u.Id == student.Id));
        Assert.False(await db.QuizSubmissions.AnyAsync(s => s.StudentId == student.Id));
        Assert.False(await db.RefreshTokens.AnyAsync(t => t.UserId == student.Id));
        Assert.False(await db.UserProfiles.AnyAsync(p => p.UserId == student.Id));
        Assert.True(await db.Quizzes.AnyAsync(q => q.Id == quiz.Id));
        Assert.True(await db.Users.AnyAsync(u => u.Id == teacher.Id));
    }

    [Fact]
    public async Task DeleteTeacher_CascadesOwnedClassContent_ButKeepsStudents()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var db = database.Context;
        var admin = User("admin");
        var teacher = User("teacher");
        var student = User("student");
        var classEntity = new EduBoost.API.Infrastructure.Entities.Class
        {
            Id = Guid.NewGuid(), Name = "Class", ClassCode = "CLASS001", Teacher = teacher
        };
        var topic = new Topic { Id = Guid.NewGuid(), Name = "Topic", Class = classEntity };
        var document = new Document
        {
            Id = Guid.NewGuid(), FileName = "lesson.pdf", Owner = teacher, Class = classEntity,
            Scope = "class", StorageKey = "classes/lesson.pdf"
        };
        var quiz = new Quiz
        {
            Id = Guid.NewGuid(), Title = "Class quiz", Owner = teacher, Class = classEntity, Topic = topic
        };
        var item = new IrtItem { Id = Guid.NewGuid(), Beta = 0 };

        db.AddRange(admin, teacher, student, classEntity, topic, document, quiz, item);
        db.Enrollments.Add(new Enrollment
        {
            Id = Guid.NewGuid(), Student = student, Class = classEntity
        });
        db.Questions.Add(new Question
        {
            Id = Guid.NewGuid(), Text = "Question", Quiz = quiz, IrtItem = item
        });
        db.QuizSubmissions.Add(new QuizSubmission
        {
            Id = Guid.NewGuid(), Student = student, Quiz = quiz, TotalQuestions = 1
        });
        await db.SaveChangesAsync();

        var storage = new FakeStorageService();
        var agent = new FakeAgentService();
        var result = await Repository(db, agent, storage).DeleteUserAsync(teacher.Id, admin.Id);

        Assert.Equal(DeleteUserResult.Deleted, result);
        Assert.False(await db.Users.AnyAsync(u => u.Id == teacher.Id));
        Assert.False(await db.Classes.AnyAsync(c => c.Id == classEntity.Id));
        Assert.False(await db.Topics.AnyAsync(t => t.Id == topic.Id));
        Assert.False(await db.Documents.AnyAsync(d => d.Id == document.Id));
        Assert.False(await db.Quizzes.AnyAsync(q => q.Id == quiz.Id));
        Assert.False(await db.QuizSubmissions.AnyAsync(s => s.QuizId == quiz.Id));
        Assert.True(await db.Users.AnyAsync(u => u.Id == student.Id));
        Assert.Contains(document.Id.ToString(), agent.DeletedDocumentIds);
        Assert.Contains((MinioStorageService.Buckets.ClassDocuments, document.StorageKey!), storage.DeletedObjects);
    }

    [Fact]
    public async Task DeleteAdmin_RejectsSelfAndLastAdmin_ButAllowsAnotherAdmin()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var db = database.Context;
        var firstAdmin = User("admin");
        var secondAdmin = User("admin");
        db.AddRange(firstAdmin, secondAdmin);
        await db.SaveChangesAsync();
        var repository = Repository(db);

        Assert.Equal(
            DeleteUserResult.SelfDeletionForbidden,
            await repository.DeleteUserAsync(firstAdmin.Id, firstAdmin.Id));

        Assert.Equal(
            DeleteUserResult.Deleted,
            await repository.DeleteUserAsync(secondAdmin.Id, firstAdmin.Id));

        Assert.Equal(
            DeleteUserResult.LastAdminForbidden,
            await repository.DeleteUserAsync(firstAdmin.Id, Guid.NewGuid()));
        Assert.True(await db.Users.AnyAsync(u => u.Id == firstAdmin.Id));
    }

    [Fact]
    public async Task ExternalCleanupFailure_DoesNotRollBackDatabaseDeletion()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var db = database.Context;
        var admin = User("admin");
        var student = User("student");
        db.AddRange(admin, student, new Document
        {
            Id = Guid.NewGuid(), FileName = "private.pdf", Owner = student,
            Scope = "student", StorageKey = "students/private.pdf"
        });
        await db.SaveChangesAsync();

        var result = await Repository(
            db,
            new FakeAgentService { ThrowOnDelete = true },
            new FakeStorageService { ThrowOnDelete = true })
            .DeleteUserAsync(student.Id, admin.Id);

        Assert.Equal(DeleteUserResult.Deleted, result);
        Assert.False(await db.Users.AnyAsync(u => u.Id == student.Id));
        Assert.False(await db.Documents.AnyAsync(d => d.OwnerId == student.Id));
    }

    private static AdminRepository Repository(
        AppDbContext db,
        IAgentService? agent = null,
        IStorageService? storage = null) =>
        new(
            db,
            agent ?? new FakeAgentService(),
            storage ?? new FakeStorageService(),
            NullLogger<AdminRepository>.Instance);

    private static User User(string role) => new()
    {
        Id = Guid.NewGuid(),
        Name = role,
        Email = $"{role}-{Guid.NewGuid():N}@test.local",
        PasswordHash = "hash",
        Role = role
    };

    private sealed class SqliteTestDatabase : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public AppDbContext Context { get; }

        private SqliteTestDatabase(SqliteConnection connection, AppDbContext context)
        {
            this.connection = connection;
            Context = context;
        }

        public static async Task<SqliteTestDatabase> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            await using (var command = connection.CreateCommand())
            {
                command.CommandText = "PRAGMA foreign_keys = ON;";
                await command.ExecuteNonQueryAsync();
            }

            var context = new AppDbContext(
                new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
            await context.Database.EnsureCreatedAsync();
            return new SqliteTestDatabase(connection, context);
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await connection.DisposeAsync();
        }
    }

    private sealed class FakeStorageService : IStorageService
    {
        public bool ThrowOnDelete { get; init; }
        public List<(string Bucket, string Key)> DeletedObjects { get; } = [];

        public Task DeleteObjectAsync(string bucket, string objectKey)
        {
            if (ThrowOnDelete) throw new InvalidOperationException("Storage unavailable");
            DeletedObjects.Add((bucket, objectKey));
            return Task.CompletedTask;
        }

        public Task<string> GetPresignedUploadUrlAsync(string bucket, string objectKey, int expirySeconds = 600) => throw new NotSupportedException();
        public Task<string> GetPresignedDownloadUrlAsync(string bucket, string objectKey, int expirySeconds = 3600) => throw new NotSupportedException();
        public Task<string> GetInternalPresignedDownloadUrlAsync(string bucket, string objectKey, int expirySeconds = 3600) => throw new NotSupportedException();
        public Task EnsureBucketExistsAsync(string bucket) => throw new NotSupportedException();
        public Task UploadObjectAsync(string bucket, string objectKey, Stream dataStream, string contentType) => throw new NotSupportedException();
    }

    private sealed class FakeAgentService : IAgentService
    {
        public bool ThrowOnDelete { get; init; }
        public List<string> DeletedDocumentIds { get; } = [];

        public Task DeleteDocumentAsync(string documentId)
        {
            if (ThrowOnDelete) throw new InvalidOperationException("Agent unavailable");
            DeletedDocumentIds.Add(documentId);
            return Task.CompletedTask;
        }

        public Task<AgentNextActionResponse?> GetNextActionAsync(string studentId, string topicName, double? masteryProbability = null, double? irtTheta = null) => throw new NotSupportedException();
        public Task<AgentQuizResponse?> GenerateQuizQuestionAsync(string topicName, double targetIrtBeta, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null, IReadOnlyList<string>? existingQuestions = null) => throw new NotSupportedException();
        public Task<string?> GetExplanationAsync(string topicName, string studentState, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null) => throw new NotSupportedException();
        public Task<string?> GetGraderExplanationAsync(string question, string correctAnswer, IReadOnlyList<AgentGraderOption>? options = null, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null) => throw new NotSupportedException();
        public Task<AgentQuizBatchResponse?> GenerateQuizBatchAsync(string topicName, string? userPrompt, string? docUrl, int numQuestions, string difficulty, int numEasy = 0, int numMedium = 0, int numHard = 0, string? documentId = null, IReadOnlyList<string>? existingQuestions = null) => throw new NotSupportedException();
        public Task<AgentChatResponse> AskAsync(string question, string? topicId, string level, List<ChatMessage> history, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null) => throw new NotSupportedException();
        public Task IngestDocumentAsync(string documentId, string fileUrl, string scope, string? classId = null, string? ownerId = null, string? topicId = null) => throw new NotSupportedException();
    }
}
