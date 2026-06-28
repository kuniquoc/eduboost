using EduBoost.API.Features.Classes;
using EduBoost.API.Features.QuizPool;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class PoolAuthorizationTests
{
    [Fact]
    public async Task CanAccessTopicAsync_StudentEnrolledInClassTopic()
    {
        await using var db = CreateDb();
        var teacherId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var otherStudentId = Guid.NewGuid();
        var classId = Guid.NewGuid();
        var topicId = Guid.NewGuid();

        SeedUsers(db, teacherId, studentId, otherStudentId);
        db.Classes.Add(new Class { Id = classId, Name = "C1", TeacherId = teacherId, ClassCode = "ABC12345", CreatedAt = DateTime.UtcNow });
        db.Enrollments.Add(new Enrollment { Id = Guid.NewGuid(), ClassId = classId, StudentId = studentId, EnrolledAt = DateTime.UtcNow });
        db.Topics.Add(new Topic { Id = topicId, Name = "Grammar", ClassId = classId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var auth = new PoolAuthorization(db, new ClassesRepository(db));

        Assert.True(await auth.CanAccessTopicAsync(studentId, "student", topicId));
        Assert.False(await auth.CanAccessTopicAsync(otherStudentId, "student", topicId));
    }

    [Fact]
    public async Task CanAccessPoolQuizzesAsync_RejectsForeignPoolQuiz()
    {
        await using var db = CreateDb();
        var ownerId = Guid.NewGuid();
        var intruderId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var quizId = Guid.NewGuid();

        db.Users.AddRange(
            new User { Id = ownerId, Name = "O", Email = "o@test.com", PasswordHash = "x", Role = "student" },
            new User { Id = intruderId, Name = "I", Email = "i@test.com", PasswordHash = "x", Role = "student" });
        db.Topics.Add(new Topic { Id = topicId, Name = "Private", OwnerId = ownerId, CreatedAt = DateTime.UtcNow });
        db.Quizzes.Add(new Quiz { Id = quizId, Title = "Pool", Type = "pool", TopicId = topicId, OwnerId = ownerId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var auth = new PoolAuthorization(db, new ClassesRepository(db));

        Assert.True(await auth.CanAccessPoolQuizzesAsync(ownerId, "student", [quizId]));
        Assert.False(await auth.CanAccessPoolQuizzesAsync(intruderId, "student", [quizId]));
    }

    private static void SeedUsers(AppDbContext db, Guid teacherId, Guid studentId, Guid otherStudentId)
    {
        db.Users.AddRange(
            new User { Id = teacherId, Name = "T", Email = "t@test.com", PasswordHash = "x", Role = "teacher" },
            new User { Id = studentId, Name = "S", Email = "s@test.com", PasswordHash = "x", Role = "student" },
            new User { Id = otherStudentId, Name = "O", Email = "o2@test.com", PasswordHash = "x", Role = "student" });
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
