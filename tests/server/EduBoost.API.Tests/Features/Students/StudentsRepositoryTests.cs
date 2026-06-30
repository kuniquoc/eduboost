using EduBoost.API.Features.Students;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class StudentsRepositoryTests
{
    [Fact]
    public async Task GetStudentAnalyticsAsync_CombinesBktMasteryWithIrtAbility()
    {
        await using var db = CreateDb();
        var teacherId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var classId = Guid.NewGuid();
        var topicId = Guid.NewGuid();

        db.Users.AddRange(
            new User { Id = teacherId, Name = "Teacher", Email = "teacher@test.local", Role = "teacher" },
            new User { Id = studentId, Name = "Student", Email = "student@test.local", Role = "student" });
        db.Classes.Add(new Class
        {
            Id = classId,
            TeacherId = teacherId,
            Name = "Class",
            ClassCode = "IRTTEST1"
        });
        db.Enrollments.Add(new Enrollment
        {
            Id = Guid.NewGuid(),
            ClassId = classId,
            StudentId = studentId
        });
        db.Topics.Add(new Topic
        {
            Id = topicId,
            ClassId = classId,
            Name = "Grammar",
            Difficulty = "medium"
        });
        db.BktStates.Add(new BktState
        {
            Id = Guid.NewGuid(),
            UserId = studentId,
            TopicId = topicId,
            MasteryProbability = 0.64
        });
        db.IrtAbilityStates.Add(new IrtAbilityState
        {
            Id = Guid.NewGuid(),
            UserId = studentId,
            TopicId = topicId,
            Theta = 0.73
        });
        await db.SaveChangesAsync();

        var repository = new StudentsRepository(db, new StudentStatsCalculator(db));
        var analytics = await repository.GetStudentAnalyticsAsync(classId, studentId);

        Assert.NotNull(analytics);
        var topic = Assert.Single(analytics!.TopicMasteries);
        Assert.Equal(0.64, topic.MasteryProbability);
        Assert.Equal(0.73, topic.IrtTheta);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
