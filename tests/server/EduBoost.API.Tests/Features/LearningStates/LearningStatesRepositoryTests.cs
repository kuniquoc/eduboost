using EduBoost.API.Features.LearningStates;
using EduBoost.API.Features.LearningStates.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class LearningStatesRepositoryTests
{
    [Fact]
    public async Task RecordAsync_UpdatesBothStates_AndIsIdempotent()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var quizId = Guid.NewGuid();
        var questionId = Guid.NewGuid();
        var attemptId = Guid.NewGuid();

        db.Topics.Add(new Topic { Id = topicId, Name = "Present Simple", OwnerId = userId });
        db.Quizzes.Add(new Quiz
        {
            Id = quizId,
            TopicId = topicId,
            Title = "Evidence quiz",
            Type = "practice"
        });
        db.Questions.Add(new Question
        {
            Id = questionId,
            QuizId = quizId,
            Text = "She ___ to school.",
            IrtItem = new IrtItem
            {
                Id = Guid.NewGuid(),
                InitialBeta = 0,
                Beta = 0
            }
        });
        await db.SaveChangesAsync();

        var evidence = new LearningEvidenceService(db);
        var repo = new LearningStatesRepository(db);

        var first = await evidence.RecordAsync(userId, topicId, questionId, true, "test", attemptId, 0);
        var duplicate = await evidence.RecordAsync(userId, topicId, questionId, true, "test", attemptId, 0);
        var state = await repo.GetStateByTopicAsync(userId, topicId);

        Assert.True(first.WasRecorded);
        Assert.False(duplicate.WasRecorded);
        Assert.Single(await db.IrtResponses.ToListAsync());
        Assert.NotNull(state);
        Assert.Equal(BktCalculator.Update(BktCalculator.InitialMastery, true), state!.MasteryProbability, 8);
        Assert.Equal(first.Theta, state.IrtTheta, 8);
        Assert.Equal(1, state.IrtResponseCount);
    }

    [Fact]
    public async Task RecomputeAbilityAsync_UsesBetaSnapshot_AndNewResponsesCaptureUpdatedBeta()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var quizId = Guid.NewGuid();
        var questionId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        const double betaAtFirstResponse = -1.1;
        const double updatedBeta = 1.2;

        db.Topics.Add(new Topic { Id = topicId, Name = "Past Simple", OwnerId = userId });
        db.Quizzes.Add(new Quiz { Id = quizId, TopicId = topicId, Title = "Snapshot quiz", Type = "practice" });
        db.Questions.Add(new Question
        {
            Id = questionId,
            QuizId = quizId,
            Text = "They ___ yesterday.",
            IrtItem = new IrtItem
            {
                Id = itemId,
                InitialBeta = betaAtFirstResponse,
                Beta = betaAtFirstResponse
            }
        });
        await db.SaveChangesAsync();

        var evidence = new LearningEvidenceService(db);
        var first = await evidence.RecordAsync(
            userId, topicId, questionId, true, "test", Guid.NewGuid(), 0);
        var firstResponse = Assert.Single(await db.IrtResponses.ToListAsync());
        Assert.Equal(betaAtFirstResponse, firstResponse.BetaAtResponse);

        var item = await db.IrtItems.FindAsync(itemId);
        item!.Beta = updatedBeta;
        await db.SaveChangesAsync();

        var recomputed = await evidence.RecomputeAbilityAsync(userId, topicId);
        Assert.Equal(first.Theta, recomputed.Theta, 8);

        var second = await evidence.RecordAsync(
            userId, topicId, questionId, true, "test", Guid.NewGuid(), 0);
        var latestResponse = await db.IrtResponses.OrderByDescending(r => r.CreatedAt).FirstAsync();
        var expected = Rasch1PlEstimator.Estimate([new RaschObservation(updatedBeta, true)]);

        Assert.Equal(updatedBeta, latestResponse.BetaAtResponse);
        Assert.Equal(expected.Theta, second.Theta, 8);
    }

    [Fact]
    public async Task EstimateAbilityAsync_UsesLatestResponsePerItem_AndRecentFiftyItemWindow()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var expectedObservations = new List<RaschObservation>();

        db.Topics.Add(new Topic { Id = topicId, Name = "Vocabulary", OwnerId = userId });

        for (var index = 0; index < 51; index++)
        {
            var itemId = Guid.NewGuid();
            var beta = -1.5 + index * 0.05;
            var isCorrect = index % 2 == 0;
            db.IrtItems.Add(new IrtItem { Id = itemId, InitialBeta = beta, Beta = 2.5 });
            db.IrtResponses.Add(CreateResponse(
                userId, topicId, itemId, beta, isCorrect, now.AddMinutes(-index)));
            if (index < 50) expectedObservations.Add(new RaschObservation(beta, isCorrect));
        }

        var repeatedItemId = db.IrtResponses.Local.First().IrtItemId;
        db.IrtResponses.Add(CreateResponse(
            userId, topicId, repeatedItemId, -2.8, false, now.AddDays(-1)));
        db.IrtResponses.Add(CreateResponse(
            userId, topicId, Guid.NewGuid(), 0.0, false, now.AddDays(-181)));
        await db.SaveChangesAsync();

        var evidence = new LearningEvidenceService(db);
        var estimate = await evidence.EstimateAbilityAsync(userId, topicId);
        var expected = Rasch1PlEstimator.Estimate(expectedObservations);

        Assert.Equal(50, estimate.ResponseCount);
        Assert.Equal(expected.Theta, estimate.Theta, 8);
        Assert.Equal(expected.StandardError, estimate.StandardError, 8);
    }

    private static IrtResponse CreateResponse(
        Guid userId,
        Guid topicId,
        Guid itemId,
        double beta,
        bool isCorrect,
        DateTime createdAt) => new()
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TopicId = topicId,
            IrtItemId = itemId,
            QuestionId = Guid.NewGuid(),
            IsCorrect = isCorrect,
            BetaAtResponse = beta,
            Source = "test",
            AttemptId = Guid.NewGuid(),
            Sequence = 0,
            CreatedAt = createdAt
        };

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
