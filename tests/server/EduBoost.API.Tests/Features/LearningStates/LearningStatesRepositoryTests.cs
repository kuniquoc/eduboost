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

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
