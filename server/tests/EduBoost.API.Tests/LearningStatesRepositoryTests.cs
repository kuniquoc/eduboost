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
    public async Task UpdateAfterAnswerAsync_CreatesSpacedRepetitionItem_WithSm2Schedule()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var questionId = Guid.NewGuid();
        var quizId = Guid.NewGuid();

        db.Topics.Add(new Topic { Id = topicId, Name = "Algebra", ClassId = Guid.NewGuid() });
        db.Quizzes.Add(new Quiz { Id = quizId, Title = "Practice", TopicId = topicId, Type = "practice" });
        db.Questions.Add(new Question
        {
            Id = questionId,
            QuizId = quizId,
            Text = "2+2=?",
            Options =
            [
                new QuizOption { Id = Guid.NewGuid(), Text = "4", IsCorrect = true, OrderIndex = 0 }
            ]
        });
        await db.SaveChangesAsync();

        var repo = new LearningStatesRepository(db, new SpacedRepetitionService());
        var response = await repo.UpdateAfterAnswerAsync(userId, new UpdateBktRequest
        {
            TopicId = topicId,
            QuestionId = questionId,
            IsCorrect = true,
            ResponseTime = 3
        });

        Assert.NotNull(response.SpacedRepetition);
        Assert.Equal(1, response.SpacedRepetition!.RepetitionCount);
        Assert.Equal(1, response.SpacedRepetition.ReviewInterval);

        var item = await db.SpacedRepetitionItems.SingleAsync(sr => sr.UserId == userId);
        Assert.Equal(questionId, item.QuestionId);

        var schedule = await repo.GetReviewScheduleAsync(userId);
        Assert.Empty(schedule.Items);
    }

    [Fact]
    public async Task GetDueQuestionIdsAsync_ReturnsOnlyDueItems()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var dueQuestionId = Guid.NewGuid();
        var futureQuestionId = Guid.NewGuid();

        db.SpacedRepetitionItems.AddRange(
            new SpacedRepetitionItem
            {
                UserId = userId,
                QuestionId = dueQuestionId,
                TopicId = Guid.NewGuid(),
                NextReviewDate = DateTime.UtcNow.AddHours(-1),
                LastReviewDate = DateTime.UtcNow.AddDays(-1)
            },
            new SpacedRepetitionItem
            {
                UserId = userId,
                QuestionId = futureQuestionId,
                TopicId = Guid.NewGuid(),
                NextReviewDate = DateTime.UtcNow.AddDays(3),
                LastReviewDate = DateTime.UtcNow
            });

        await db.SaveChangesAsync();

        var repo = new LearningStatesRepository(db, new SpacedRepetitionService());
        var dueIds = await repo.GetDueQuestionIdsAsync(userId);

        Assert.Single(dueIds);
        Assert.Equal(dueQuestionId, dueIds[0]);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
