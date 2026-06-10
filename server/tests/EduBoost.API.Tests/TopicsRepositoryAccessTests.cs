using EduBoost.API.Features.Topics;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class TopicsRepositoryAccessTests
{
    [Fact]
    public async Task BelongsToClassAsync_OnlyWhenClassMatches()
    {
        await using var db = CreateDb();
        var classA = Guid.NewGuid();
        var classB = Guid.NewGuid();
        var topicId = Guid.NewGuid();

        db.Topics.Add(new Topic { Id = topicId, Name = "T1", ClassId = classA, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var repo = new TopicsRepository(db, new FakeRoadmapRepository());

        Assert.True(await repo.BelongsToClassAsync(topicId, classA));
        Assert.False(await repo.BelongsToClassAsync(topicId, classB));
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private sealed class FakeRoadmapRepository : EduBoost.API.Features.Roadmap.IRoadmapRepository
    {
        public Task<EduBoost.API.Features.Roadmap.Models.RoadmapDto?> GetByClassIdAsync(Guid classId, Guid studentId) => Task.FromResult<EduBoost.API.Features.Roadmap.Models.RoadmapDto?>(null);
        public Task<EduBoost.API.Features.Roadmap.Models.RoadmapDto> GenerateAsync(Guid classId, Guid studentId, string entryTestResultId) => throw new NotImplementedException();
        public Task<EduBoost.API.Features.Roadmap.Models.RoadmapStepDto?> UpdateStepAsync(Guid classId, Guid studentId, string stepId, EduBoost.API.Features.Roadmap.Models.UpdateStepRequest request) => Task.FromResult<EduBoost.API.Features.Roadmap.Models.RoadmapStepDto?>(null);
        public Task EnsureClassTopicsSyncedAsync(Guid classId, Guid studentId) => Task.CompletedTask;
        public Task SyncAfterLearningAsync(Guid classId, Guid studentId, Guid topicId) => Task.CompletedTask;
    }
}
