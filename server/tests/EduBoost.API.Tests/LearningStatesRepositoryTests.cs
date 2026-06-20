using EduBoost.API.Features.LearningStates;
using EduBoost.API.Features.LearningStates.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class LearningStatesRepositoryTests
{
    [Fact]
    public async Task UpdateAfterAnswerAsync_NormalizesLegacyBktParametersBeforeUpdating()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var topicId = Guid.NewGuid();

        db.Topics.Add(new Topic { Id = topicId, Name = "Present Simple", OwnerId = userId });
        db.BktStates.Add(new BktState
        {
            UserId = userId,
            TopicId = topicId,
            MasteryProbability = 0.3,
            GuessProbability = 0.25,
            SlipProbability = 0.10,
            TransitionProbability = 0.10
        });
        await db.SaveChangesAsync();

        var repo = new LearningStatesRepository(db);

        for (var i = 0; i < 3; i++)
        {
            await repo.UpdateAfterAnswerAsync(userId, new UpdateBktRequest
            {
                TopicId = topicId,
                QuestionId = Guid.NewGuid(),
                IsCorrect = true,
                QuestionDifficultyIndex = 0
            });
        }

        var state = await db.BktStates.SingleAsync();

        Assert.Equal(BktIrtCalculator.DefaultGuessProbability, state.GuessProbability);
        Assert.Equal(BktIrtCalculator.DefaultSlipProbability, state.SlipProbability);
        Assert.Equal(BktIrtCalculator.DefaultTransitionProbability, state.TransitionProbability);
        Assert.True(state.MasteryProbability < 0.95);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
