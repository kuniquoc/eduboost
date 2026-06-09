using EduBoost.API.Features.Classes.Models;
using EduBoost.API.Features.Topics;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Classes;

public interface IClassesRepository
{
    Task<List<ClassDto>> GetByTeacherIdAsync(Guid teacherId);
    Task<List<ClassDto>> GetEnrolledByStudentIdAsync(Guid studentId);
    Task<ClassDetailDto?> GetByIdAsync(Guid classId);
    Task<ClassDto> CreateAsync(Guid teacherId, CreateClassRequest request);
    Task<ClassDto?> UpdateAsync(Guid classId, Guid teacherId, UpdateClassRequest request);
    Task<bool> DeleteAsync(Guid classId, Guid teacherId);
    Task<bool> IsOwnedByTeacherAsync(Guid classId, Guid teacherId);
    Task<bool> IsStudentEnrolledAsync(Guid classId, Guid studentId);
    Task<bool> CanUserAccessClassAsync(Guid classId, Guid userId, string role);
    Task<ClassDto?> JoinByCodeAsync(Guid studentId, string classCode);
    Task<List<StudentEnrollmentDto>> GetStudentsAsync(Guid classId, string? search);
    Task<bool> AddStudentAsync(Guid classId, string studentEmail);
    Task<bool> RemoveStudentAsync(Guid classId, Guid studentId);
}

public class StudentEnrollmentDto
{
    public string StudentId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Avatar { get; set; }
    public string EnrolledAt { get; set; } = "";
    public bool EntryTestCompleted { get; set; }
    public int Progress { get; set; }
}

public class ClassesRepository(AppDbContext db) : IClassesRepository
{
    public async Task<List<ClassDto>> GetByTeacherIdAsync(Guid teacherId)
    {
        return await db.Classes
            .Where(c => c.TeacherId == teacherId)
            .Select(c => new ClassDto
            {
                Id             = c.Id.ToString(),
                Name           = c.Name,
                Description    = c.Description,
                CoverColor     = c.CoverColor,
                ClassCode      = c.ClassCode,
                CreatedAt      = c.CreatedAt.ToString("yyyy-MM-dd"),
                TeacherId      = c.TeacherId.ToString(),
                StudentCount   = c.Enrollments.Count,
                TopicCount     = c.Topics.Count,
                AverageProgress = c.Enrollments.Any()
                    ? (int)c.Enrollments.Average(e => e.Progress)
                    : 0
            })
            .ToListAsync();
    }

    public async Task<List<ClassDto>> GetEnrolledByStudentIdAsync(Guid studentId)
    {
        return await db.Enrollments
            .Where(e => e.StudentId == studentId)
            .Select(e => new ClassDto
            {
                Id             = e.Class.Id.ToString(),
                Name           = e.Class.Name,
                Description    = e.Class.Description,
                CoverColor     = e.Class.CoverColor,
                ClassCode      = e.Class.ClassCode,
                CreatedAt      = e.Class.CreatedAt.ToString("yyyy-MM-dd"),
                TeacherId      = e.Class.TeacherId.ToString(),
                StudentCount   = e.Class.Enrollments.Count,
                TopicCount     = e.Class.Topics.Count,
                AverageProgress = e.Class.Enrollments.Any()
                    ? (int)e.Class.Enrollments.Average(en => en.Progress)
                    : 0
            })
            .ToListAsync();
    }

    public async Task<ClassDetailDto?> GetByIdAsync(Guid classId)
    {
        var cls = await db.Classes
            .Include(c => c.Enrollments)
            .Include(c => c.Topics)
            .FirstOrDefaultAsync(c => c.Id == classId);

        if (cls == null) return null;

        return new ClassDetailDto
        {
            Id             = cls.Id.ToString(),
            Name           = cls.Name,
            Description    = cls.Description,
            CoverColor     = cls.CoverColor,
            ClassCode      = cls.ClassCode,
            CreatedAt      = cls.CreatedAt.ToString("yyyy-MM-dd"),
            TeacherId      = cls.TeacherId.ToString(),
            StudentCount   = cls.Enrollments.Count,
            TopicCount     = cls.Topics.Count,
            AverageProgress = cls.Enrollments.Any()
                ? (int)cls.Enrollments.Average(e => e.Progress)
                : 0,
            Topics = cls.Topics
                .OrderBy(t => t.CreatedAt)
                .Select(t => new TopicSummaryDto
                {
                    Id               = t.Id.ToString(),
                    Name             = t.Name,
                    Difficulty       = t.Difficulty,
                    AiEvaluated      = t.AiEvaluated,
                    IsDocumentVisible = t.IsDocumentVisible,
                    QuestionCount    = db.Questions.Count(q => q.Quiz.TopicId == t.Id)
                })
                .ToList()
        };
    }

    public async Task<ClassDto> CreateAsync(Guid teacherId, CreateClassRequest request)
    {
        var cls = new Class
        {
            Id          = Guid.NewGuid(),
            Name        = request.Name,
            Description = request.Description,
            CoverColor  = request.CoverColor,
            ClassCode   = GenerateCode(),
            TeacherId   = teacherId,
            CreatedAt   = DateTime.UtcNow
        };

        db.Classes.Add(cls);
        await db.SaveChangesAsync();

        return new ClassDto
        {
            Id          = cls.Id.ToString(),
            Name        = cls.Name,
            Description = cls.Description,
            CoverColor  = cls.CoverColor,
            ClassCode   = cls.ClassCode,
            TeacherId   = cls.TeacherId.ToString(),
            CreatedAt   = cls.CreatedAt.ToString("yyyy-MM-dd"),
            StudentCount = 0,
            TopicCount   = 0,
            AverageProgress = 0
        };
    }

    public async Task<bool> IsOwnedByTeacherAsync(Guid classId, Guid teacherId) =>
        await db.Classes.AnyAsync(c => c.Id == classId && c.TeacherId == teacherId);

    public async Task<bool> IsStudentEnrolledAsync(Guid classId, Guid studentId) =>
        await db.Enrollments.AnyAsync(e => e.ClassId == classId && e.StudentId == studentId);

    public async Task<bool> CanUserAccessClassAsync(Guid classId, Guid userId, string role)
    {
        if (role == "admin") return true;
        if (role == "teacher") return await IsOwnedByTeacherAsync(classId, userId);
        if (role == "student") return await IsStudentEnrolledAsync(classId, userId);
        return false;
    }

    public async Task<ClassDto?> UpdateAsync(Guid classId, Guid teacherId, UpdateClassRequest request)
    {
        var cls = await db.Classes.FindAsync(classId);
        if (cls == null || cls.TeacherId != teacherId) return null;

        if (request.Name        != null) cls.Name        = request.Name;
        if (request.Description != null) cls.Description = request.Description;
        if (request.CoverColor  != null) cls.CoverColor  = request.CoverColor;

        await db.SaveChangesAsync();

        return new ClassDto
        {
            Id          = cls.Id.ToString(),
            Name        = cls.Name,
            Description = cls.Description,
            CoverColor  = cls.CoverColor,
            ClassCode   = cls.ClassCode,
            TeacherId   = cls.TeacherId.ToString(),
            CreatedAt   = cls.CreatedAt.ToString("yyyy-MM-dd")
        };
    }

    public async Task<bool> DeleteAsync(Guid classId, Guid teacherId)
    {
        var cls = await db.Classes.FindAsync(classId);
        if (cls == null || cls.TeacherId != teacherId) return false;
        db.Classes.Remove(cls);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<ClassDto?> JoinByCodeAsync(Guid studentId, string classCode)
    {
        var cls = await db.Classes
            .Include(c => c.Enrollments)
            .FirstOrDefaultAsync(c => c.ClassCode.ToLower() == classCode.ToLower());

        if (cls == null) return null;

        var alreadyEnrolled = cls.Enrollments.Any(e => e.StudentId == studentId);
        if (!alreadyEnrolled)
        {
            db.Enrollments.Add(new Enrollment
            {
                Id        = Guid.NewGuid(),
                StudentId = studentId,
                ClassId   = cls.Id,
                EnrolledAt = DateTime.UtcNow,
                Progress  = 0
            });
            await db.SaveChangesAsync();
        }

        return new ClassDto
        {
            Id          = cls.Id.ToString(),
            Name        = cls.Name,
            Description = cls.Description,
            CoverColor  = cls.CoverColor,
            ClassCode   = cls.ClassCode,
            TeacherId   = cls.TeacherId.ToString(),
            CreatedAt   = cls.CreatedAt.ToString("yyyy-MM-dd"),
            StudentCount = cls.Enrollments.Count + (alreadyEnrolled ? 0 : 1)
        };
    }

    public async Task<List<StudentEnrollmentDto>> GetStudentsAsync(Guid classId, string? search)
    {
        var query = db.Enrollments
            .Where(e => e.ClassId == classId)
            .Include(e => e.Student)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(e => e.Student.Name.ToLower().Contains(search.ToLower()));

        return await query
            .OrderBy(e => e.EnrolledAt)
            .Select(e => new StudentEnrollmentDto
            {
                StudentId          = e.StudentId.ToString(),
                Name               = e.Student.Name,
                Email              = e.Student.Email,
                Avatar             = e.Student.AvatarInitials,
                EnrolledAt         = e.EnrolledAt.ToString("yyyy-MM-dd"),
                EntryTestCompleted = e.EntryTestCompleted,
                Progress           = e.Progress
            })
            .ToListAsync();
    }

    public async Task<bool> AddStudentAsync(Guid classId, string studentEmail)
    {
        var student = await db.Users
            .SingleOrDefaultAsync(u => u.Email.ToLower() == studentEmail.ToLower() && u.Role == "student");

        if (student == null) return false;

        var exists = await db.Enrollments
            .AnyAsync(e => e.ClassId == classId && e.StudentId == student.Id);

        if (!exists)
        {
            db.Enrollments.Add(new Enrollment
            {
                Id        = Guid.NewGuid(),
                ClassId   = classId,
                StudentId = student.Id,
                EnrolledAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }
        return true;
    }

    public async Task<bool> RemoveStudentAsync(Guid classId, Guid studentId)
    {
        var enrollment = await db.Enrollments
            .FirstOrDefaultAsync(e => e.ClassId == classId && e.StudentId == studentId);

        if (enrollment == null) return false;
        db.Enrollments.Remove(enrollment);
        await db.SaveChangesAsync();
        return true;
    }

    private static string GenerateCode() =>
        new(Enumerable.Range(0, 8)
            .Select(_ => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Random.Shared.Next(32)])
            .ToArray());
}
