using EduBoost.API.Common.Learning;
using EduBoost.API.Features.LearningStates;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EduBoost.API.Tests;

public class IrtAbilityBackfillServiceTests
{
    [Fact]
    public async Task RunAsync_RecomputesOldStates_PreservesLegacyStates_AndIsIdempotent()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var responseTopicId = Guid.NewGuid();
        var legacyTopicId = Guid.NewGuid();
        var currentTopicId = Guid.NewGuid();
        var itemId = Guid.NewGuid();

        db.Topics.AddRange(
            new Topic { Id = responseTopicId, Name = "Grammar", OwnerId = userId },
            new Topic { Id = legacyTopicId, Name = "Legacy", OwnerId = userId },
            new Topic { Id = currentTopicId, Name = "Current", OwnerId = userId });
        db.IrtItems.Add(new IrtItem { Id = itemId, InitialBeta = -1.0, Beta = 2.0 });
        db.IrtAbilityStates.AddRange(
            new IrtAbilityState
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TopicId = responseTopicId,
                Theta = 2.5,
                StandardError = 0.2,
                ResponseCount = 99,
                EstimatorVersion = 1
            },
            new IrtAbilityState
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TopicId = legacyTopicId,
                Theta = 0.75,
                StandardError = 0.4,
                ResponseCount = 0,
                EstimatorVersion = 1
            },
            new IrtAbilityState
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TopicId = currentTopicId,
                Theta = -0.25,
                StandardError = 0.8,
                ResponseCount = 1,
                EstimatorVersion = Rasch1PlEstimator.CurrentVersion
            });
        db.IrtResponses.Add(new IrtResponse
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TopicId = responseTopicId,
            IrtItemId = itemId,
            QuestionId = Guid.NewGuid(),
            IsCorrect = true,
            BetaAtResponse = -1.0,
            Source = "test",
            AttemptId = Guid.NewGuid(),
            Sequence = 0,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var evidence = new LearningEvidenceService(db);
        var service = new IrtAbilityBackfillService(
            db, evidence, NullLogger<IrtAbilityBackfillService>.Instance);

        await service.RunAsync();

        var expected = Rasch1PlEstimator.Estimate([new RaschObservation(-1.0, true)]);
        var recomputed = await db.IrtAbilityStates.SingleAsync(a => a.TopicId == responseTopicId);
        var preserved = await db.IrtAbilityStates.SingleAsync(a => a.TopicId == legacyTopicId);
        var skipped = await db.IrtAbilityStates.SingleAsync(a => a.TopicId == currentTopicId);

        Assert.Equal(expected.Theta, recomputed.Theta, 8);
        Assert.Equal(expected.StandardError, recomputed.StandardError, 8);
        Assert.Equal(1, recomputed.ResponseCount);
        Assert.Equal(Rasch1PlEstimator.CurrentVersion, recomputed.EstimatorVersion);
        Assert.Equal(0.75, preserved.Theta);
        Assert.Equal(0.4, preserved.StandardError);
        Assert.Equal(Rasch1PlEstimator.CurrentVersion, preserved.EstimatorVersion);
        Assert.Equal(-0.25, skipped.Theta);

        await service.RunAsync();

        Assert.Equal(expected.Theta, recomputed.Theta, 8);
        Assert.Equal(0.75, preserved.Theta);
        Assert.Equal(-0.25, skipped.Theta);
    }

    [Fact]
    public async Task RunAsync_ResetsStateWhenAllRecordedEvidenceIsOutsideAbilityWindow()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var itemId = Guid.NewGuid();

        db.Topics.Add(new Topic { Id = topicId, Name = "Expired", OwnerId = userId });
        db.IrtItems.Add(new IrtItem { Id = itemId, InitialBeta = 0, Beta = 0 });
        db.IrtAbilityStates.Add(new IrtAbilityState
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TopicId = topicId,
            Theta = 1.5,
            StandardError = 0.2,
            ResponseCount = 4,
            EstimatorVersion = 1
        });
        db.IrtResponses.Add(new IrtResponse
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TopicId = topicId,
            IrtItemId = itemId,
            QuestionId = Guid.NewGuid(),
            IsCorrect = true,
            BetaAtResponse = 0,
            Source = "test",
            AttemptId = Guid.NewGuid(),
            Sequence = 0,
            CreatedAt = DateTime.UtcNow.AddDays(-181)
        });
        await db.SaveChangesAsync();

        var service = new IrtAbilityBackfillService(
            db,
            new LearningEvidenceService(db),
            NullLogger<IrtAbilityBackfillService>.Instance);
        await service.RunAsync();

        var state = await db.IrtAbilityStates.SingleAsync();
        Assert.Equal(0.0, state.Theta);
        Assert.Equal(1.0, state.StandardError);
        Assert.Equal(0, state.ResponseCount);
        Assert.Equal(Rasch1PlEstimator.CurrentVersion, state.EstimatorVersion);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
