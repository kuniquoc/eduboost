using EduBoost.API.Features.Classes;
using EduBoost.API.Features.Quizzes;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class QuizAuthorizationTests
{
    [Fact]
    public async Task CanTeacherManageQuizAsync_OnlyClassOwner()
    {
        await using var db = CreateDb();
        var teacherId = Guid.NewGuid();
        var otherTeacherId = Guid.NewGuid();
        var classId = Guid.NewGuid();
        var quizId = Guid.NewGuid();

        db.Users.AddRange(
            new User { Id = teacherId, Name = "T1", Email = "t1@test.com", PasswordHash = "x", Role = "teacher" },
            new User { Id = otherTeacherId, Name = "T2", Email = "t2@test.com", PasswordHash = "x", Role = "teacher" });
        db.Classes.Add(new Class { Id = classId, Name = "C1", TeacherId = teacherId, ClassCode = "ABC12345", CreatedAt = DateTime.UtcNow });
        db.Quizzes.Add(new Quiz { Id = quizId, Title = "Q1", Type = "practice", ClassId = classId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var auth = new QuizAuthorization(db, new ClassesRepository(db));

        Assert.True(await auth.CanTeacherManageQuizAsync(quizId, teacherId));
        Assert.False(await auth.CanTeacherManageQuizAsync(quizId, otherTeacherId));
    }

    [Fact]
    public async Task CanStudentAccessPrivateQuizAsync_RequiresOwnerId()
    {
        await using var db = CreateDb();
        var studentId = Guid.NewGuid();
        var quizId = Guid.NewGuid();

        db.Users.Add(new User { Id = studentId, Name = "S", Email = "s@test.com", PasswordHash = "x", Role = "student" });
        db.Quizzes.Add(new Quiz { Id = quizId, Title = "My", Type = "private", OwnerId = studentId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var auth = new QuizAuthorization(db, new ClassesRepository(db));

        Assert.True(await auth.CanStudentAccessPrivateQuizAsync(quizId, studentId));
        Assert.False(await auth.CanStudentAccessPrivateQuizAsync(quizId, Guid.NewGuid()));
    }

    [Fact]
    public async Task QuestionBelongsToQuizAsync_RequiresMatchingQuizId()
    {
        await using var db = CreateDb();
        var quizA = Guid.NewGuid();
        var quizB = Guid.NewGuid();
        var questionId = Guid.NewGuid();

        db.Quizzes.AddRange(
            new Quiz { Id = quizA, Title = "A", Type = "private", CreatedAt = DateTime.UtcNow },
            new Quiz { Id = quizB, Title = "B", Type = "private", CreatedAt = DateTime.UtcNow });
        db.Questions.Add(new Question { Id = questionId, QuizId = quizA, Text = "Q?", Type = "mcq", OrderIndex = 0 });
        await db.SaveChangesAsync();

        var auth = new QuizAuthorization(db, new ClassesRepository(db));

        Assert.True(await auth.QuestionBelongsToQuizAsync(quizA, questionId));
        Assert.False(await auth.QuestionBelongsToQuizAsync(quizB, questionId));
    }

    [Fact]
    public async Task CanStudentAccessTopicAsync_AllowsPrivateTopicOwner()
    {
        await using var db = CreateDb();
        var studentId = Guid.NewGuid();
        var topicId = Guid.NewGuid();

        db.Users.Add(new User { Id = studentId, Name = "S", Email = "s@test.com", PasswordHash = "x", Role = "student" });
        db.Topics.Add(new Topic { Id = topicId, Name = "My topic", OwnerId = studentId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var auth = new QuizAuthorization(db, new ClassesRepository(db));

        Assert.True(await auth.CanStudentAccessTopicAsync(topicId, studentId));
        Assert.False(await auth.CanStudentAccessTopicAsync(topicId, Guid.NewGuid()));
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
