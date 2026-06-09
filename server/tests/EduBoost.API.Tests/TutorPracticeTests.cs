using EduBoost.API.Features.Quizzes;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class TutorPracticeTests
{
    [Fact]
    public async Task CompleteTutorPracticeAsync_CreatesLearningSession_AndUpdatesStreak()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var topicId = Guid.NewGuid();

        db.Topics.Add(new Topic { Id = topicId, Name = "Algebra", OwnerId = userId });
        db.UserProfiles.Add(new UserProfile
        {
            UserId = userId,
            LearningStreak = 1,
            LastActiveDate = DateTime.UtcNow.AddDays(-1),
        });
        await db.SaveChangesAsync();

        var repo = new QuizzesRepository(db, null!, null!, null!, null!);
        await repo.CompleteTutorPracticeAsync(userId, topicId, 5, 4);

        var session = await db.LearningSessions.SingleAsync(ls => ls.UserId == userId);
        Assert.Equal(5, session.QuestionsAttempted);
        Assert.Equal(4, session.CorrectAnswers);

        var profile = await db.UserProfiles.SingleAsync(p => p.UserId == userId);
        Assert.Equal(2, profile.LearningStreak);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
