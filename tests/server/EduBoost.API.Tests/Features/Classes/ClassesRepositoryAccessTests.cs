using EduBoost.API.Features.Classes;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class ClassesRepositoryAccessTests
{
    [Fact]
    public async Task CanUserAccessClassAsync_TeacherOnlyOwnsClass()
    {
        await using var db = CreateDb();
        var teacherId = Guid.NewGuid();
        var otherTeacherId = Guid.NewGuid();
        var classId = Guid.NewGuid();

        db.Users.AddRange(
            new User { Id = teacherId, Name = "T1", Email = "t1@test.com", PasswordHash = "x", Role = "teacher" },
            new User { Id = otherTeacherId, Name = "T2", Email = "t2@test.com", PasswordHash = "x", Role = "teacher" });
        db.Classes.Add(new Class { Id = classId, Name = "C1", TeacherId = teacherId, ClassCode = "ABC12345", CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var repo = new ClassesRepository(db);

        Assert.True(await repo.CanUserAccessClassAsync(classId, teacherId, "teacher"));
        Assert.False(await repo.CanUserAccessClassAsync(classId, otherTeacherId, "teacher"));
    }

    [Fact]
    public async Task CanUserAccessClassAsync_StudentOnlyWhenEnrolled()
    {
        await using var db = CreateDb();
        var teacherId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var classId = Guid.NewGuid();

        db.Users.AddRange(
            new User { Id = teacherId, Name = "T", Email = "t@test.com", PasswordHash = "x", Role = "teacher" },
            new User { Id = studentId, Name = "S", Email = "s@test.com", PasswordHash = "x", Role = "student" });
        db.Classes.Add(new Class { Id = classId, Name = "C1", TeacherId = teacherId, ClassCode = "ABC12345", CreatedAt = DateTime.UtcNow });
        db.Enrollments.Add(new Enrollment { Id = Guid.NewGuid(), ClassId = classId, StudentId = studentId, EnrolledAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var repo = new ClassesRepository(db);

        Assert.True(await repo.CanUserAccessClassAsync(classId, studentId, "student"));
        Assert.False(await repo.CanUserAccessClassAsync(classId, Guid.NewGuid(), "student"));
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
