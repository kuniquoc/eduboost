using EduBoost.API.Features.Auth;
using EduBoost.API.Features.Auth.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace EduBoost.API.Tests;

public class AuthRepositoryTests
{
    private sealed class NoOpStorage : IStorageService
    {
        public Task<string> GetPresignedUploadUrlAsync(string bucket, string objectKey, int expirySeconds = 600) => Task.FromResult("");
        public Task<string> GetPresignedDownloadUrlAsync(string bucket, string objectKey, int expirySeconds = 3600) => Task.FromResult("");
        public Task<string> GetInternalPresignedDownloadUrlAsync(string bucket, string objectKey, int expirySeconds = 3600) => Task.FromResult("");
        public Task DeleteObjectAsync(string bucket, string objectKey) => Task.CompletedTask;
        public Task EnsureBucketExistsAsync(string bucket) => Task.CompletedTask;
        public Task UploadObjectAsync(string bucket, string objectKey, Stream dataStream, string contentType) => Task.CompletedTask;
    }

    private static AuthRepository CreateRepo(AppDbContext db)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "test-secret-must-be-at-least-32-characters-long",
                ["Jwt:Issuer"] = "EduBoost",
                ["Jwt:Audience"] = "EduBoost",
            })
            .Build();

        return new AuthRepository(db, config, new NoOpStorage());
    }

    [Fact]
    public async Task RegisterAsync_RejectsNonStudentRole()
    {
        await using var db = CreateInMemoryDb();
        var repo = CreateRepo(db);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            repo.RegisterAsync(new RegisterRequest
            {
                Name = "Teacher Try",
                Email = "teacher@example.com",
                Password = "password123",
                Role = "teacher",
            }));

        Assert.Contains("học sinh", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, await db.Users.CountAsync());
    }

    [Fact]
    public async Task RegisterAsync_ForcesStudentRole()
    {
        await using var db = CreateInMemoryDb();
        var repo = CreateRepo(db);

        var tokens = await repo.RegisterAsync(new RegisterRequest
        {
            Name = "Student One",
            Email = "student@example.com",
            Password = "password123",
            Role = "student",
        });

        Assert.Equal("student", tokens.User.Role);
        var user = await db.Users.SingleAsync();
        Assert.Equal("student", user.Role);
    }

    private static AppDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
