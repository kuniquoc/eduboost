using EduBoost.API.Features.Roadmap;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class RoadmapRepositoryTests
{
    [Fact]
    public async Task SyncAfterLearning_marksComplete_whenMasteryAboveThreshold()
    {
        await using var db = CreateDb();
        var classId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var topicId = Guid.NewGuid();

        SeedTopicAndPath(db, classId, studentId, topicId, orderIndex: 1);
        db.BktStates.Add(new BktState
        {
            UserId = studentId,
            TopicId = topicId,
            MasteryProbability = 0.96
        });
        await db.SaveChangesAsync();

        var repo = new RoadmapRepository(db);
        await repo.SyncAfterLearningAsync(classId, studentId, topicId);

        var path = await db.PersonalizedLearningPaths.SingleAsync();
        Assert.True(path.IsCompleted);
    }

    [Fact]
    public async Task SyncAfterLearning_reordersIncompleteByWeakestBkt()
    {
        await using var db = CreateDb();
        var classId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var weakTopicId = Guid.NewGuid();
        var strongTopicId = Guid.NewGuid();

        db.Topics.AddRange(
            new Topic { Id = weakTopicId, ClassId = classId, Name = "Weak", Difficulty = "easy", CreatedAt = DateTime.UtcNow },
            new Topic { Id = strongTopicId, ClassId = classId, Name = "Strong", Difficulty = "easy", CreatedAt = DateTime.UtcNow.AddMinutes(1) });

        db.PersonalizedLearningPaths.AddRange(
            new PersonalizedLearningPath
            {
                Id = Guid.NewGuid(),
                UserId = studentId,
                TopicId = strongTopicId,
                OrderIndex = 1,
                IsCompleted = false,
                PriorityScore = 0.5
            },
            new PersonalizedLearningPath
            {
                Id = Guid.NewGuid(),
                UserId = studentId,
                TopicId = weakTopicId,
                OrderIndex = 2,
                IsCompleted = false,
                PriorityScore = 0.5
            });

        db.BktStates.AddRange(
            new BktState { UserId = studentId, TopicId = weakTopicId, MasteryProbability = 0.2 },
            new BktState { UserId = studentId, TopicId = strongTopicId, MasteryProbability = 0.8 });

        await db.SaveChangesAsync();

        var repo = new RoadmapRepository(db);
        await repo.SyncAfterLearningAsync(classId, studentId, weakTopicId);

        var paths = await db.PersonalizedLearningPaths
            .OrderBy(p => p.OrderIndex)
            .ToListAsync();

        Assert.Equal(weakTopicId, paths[0].TopicId);
        Assert.Equal(strongTopicId, paths[1].TopicId);
    }

    [Fact]
    public async Task EnsureClassTopicsSynced_addsNewTopic_withoutResettingCompleted()
    {
        await using var db = CreateDb();
        var classId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var existingTopicId = Guid.NewGuid();
        var newTopicId = Guid.NewGuid();

        db.Topics.Add(new Topic
        {
            Id = existingTopicId,
            ClassId = classId,
            Name = "Existing",
            Difficulty = "medium",
            CreatedAt = DateTime.UtcNow
        });

        db.PersonalizedLearningPaths.Add(new PersonalizedLearningPath
        {
            Id = Guid.NewGuid(),
            UserId = studentId,
            TopicId = existingTopicId,
            OrderIndex = 1,
            IsCompleted = true,
            PriorityScore = 0.1
        });

        await db.SaveChangesAsync();

        db.Topics.Add(new Topic
        {
            Id = newTopicId,
            ClassId = classId,
            Name = "New Topic",
            Difficulty = "easy",
            CreatedAt = DateTime.UtcNow.AddMinutes(1)
        });
        await db.SaveChangesAsync();

        var repo = new RoadmapRepository(db);
        await repo.EnsureClassTopicsSyncedAsync(classId, studentId);

        var paths = await db.PersonalizedLearningPaths.ToListAsync();
        Assert.Equal(2, paths.Count);
        Assert.Contains(paths, p => p.TopicId == newTopicId && !p.IsCompleted);
        Assert.Contains(paths, p => p.TopicId == existingTopicId && p.IsCompleted);
    }

    [Fact]
    public async Task GenerateAsync_prioritizesPlacementWeaknesses()
    {
        await using var db = CreateDb();
        var classId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var weakTopicId = Guid.NewGuid();
        var strongTopicId = Guid.NewGuid();

        db.Topics.AddRange(
            new Topic { Id = weakTopicId, ClassId = classId, Name = "Weak", Difficulty = "hard", CreatedAt = DateTime.UtcNow },
            new Topic { Id = strongTopicId, ClassId = classId, Name = "Strong", Difficulty = "easy", CreatedAt = DateTime.UtcNow.AddMinutes(1) });

        var resultId = Guid.NewGuid();
        db.PlacementTestResults.Add(new PlacementTestResult
        {
            Id = resultId,
            UserId = studentId,
            ClassId = classId,
            WeaknessesJson = $"[{{\"TopicId\":\"{weakTopicId}\"}}]"
        });
        await db.SaveChangesAsync();

        var repo = new RoadmapRepository(db);
        var roadmap = await repo.GenerateAsync(classId, studentId, resultId.ToString());

        Assert.Equal(weakTopicId.ToString(), roadmap.Steps[0].TopicId);
        Assert.Equal(strongTopicId.ToString(), roadmap.Steps[1].TopicId);
    }

    [Fact]
    public async Task GenerateAsync_keepsAllIncompleteTopicsAvailable()
    {
        await using var db = CreateDb();
        var classId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var firstTopicId = Guid.NewGuid();
        var secondTopicId = Guid.NewGuid();

        db.Topics.AddRange(
            new Topic { Id = firstTopicId, ClassId = classId, Name = "First", Difficulty = "easy", CreatedAt = DateTime.UtcNow },
            new Topic { Id = secondTopicId, ClassId = classId, Name = "Second", Difficulty = "medium", CreatedAt = DateTime.UtcNow.AddMinutes(1) });
        await db.SaveChangesAsync();

        var repo = new RoadmapRepository(db);
        var roadmap = await repo.GenerateAsync(classId, studentId, entryTestResultId: string.Empty);

        Assert.Equal("recommended", roadmap.Steps[0].Status);
        Assert.Equal("in_progress", roadmap.Steps[1].Status);
        Assert.DoesNotContain(roadmap.Steps, step => step.Status == "locked");
    }

    [Fact]
    public async Task GetByClassId_UsesActualBktState_ForDisplayedProgress()
    {
        await using var db = CreateDb();
        var classId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var topicId = Guid.NewGuid();

        SeedTopicAndPath(db, classId, studentId, topicId, orderIndex: 1);
        db.BktStates.Add(new BktState
        {
            UserId = studentId,
            TopicId = topicId,
            MasteryProbability = 0.72,
            IrtTheta = 0.4
        });
        await db.SaveChangesAsync();

        var repo = new RoadmapRepository(db);
        var roadmap = await repo.GetByClassIdAsync(classId, studentId);

        Assert.NotNull(roadmap);
        var step = Assert.Single(roadmap!.Steps);
        Assert.Equal(72, step.Progress);
        Assert.NotNull(step.Mastery);
        Assert.InRange(step.Mastery!.Value, 0.719, 0.721);
    }

    [Fact]
    public async Task GetByClassId_UsesZeroDisplayProgress_WhenNoBktStateExists()
    {
        await using var db = CreateDb();
        var classId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var topicId = Guid.NewGuid();

        SeedTopicAndPath(db, classId, studentId, topicId, orderIndex: 1);
        await db.SaveChangesAsync();

        var repo = new RoadmapRepository(db);
        var roadmap = await repo.GetByClassIdAsync(classId, studentId);

        Assert.NotNull(roadmap);
        var step = Assert.Single(roadmap!.Steps);
        Assert.Equal(0, step.Progress);
        Assert.Equal(0, step.Mastery);
    }

    private static void SeedTopicAndPath(AppDbContext db, Guid classId, Guid studentId, Guid topicId, int orderIndex)
    {
        db.Topics.Add(new Topic
        {
            Id = topicId,
            ClassId = classId,
            Name = "Topic",
            Difficulty = "medium",
            CreatedAt = DateTime.UtcNow
        });

        db.PersonalizedLearningPaths.Add(new PersonalizedLearningPath
        {
            Id = Guid.NewGuid(),
            UserId = studentId,
            TopicId = topicId,
            OrderIndex = orderIndex,
            IsCompleted = false,
            PriorityScore = 0.5
        });
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
