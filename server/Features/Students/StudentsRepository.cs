using EduBoost.API.Features.Students.Models;
using EduBoost.API.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Students;

public interface IStudentsRepository
{
    Task<ClassAnalyticsDto> GetClassAnalyticsAsync(Guid classId);
    Task<StudentAnalyticsDto?> GetStudentAnalyticsAsync(Guid classId, Guid studentId);
    Task<StudentProgressDto> GetMyProgressAsync(Guid studentId);
    Task<StudentStatsDto> GetMyStatsAsync(Guid studentId);
}

public class StudentsRepository(AppDbContext db) : IStudentsRepository
{
    public async Task<ClassAnalyticsDto> GetClassAnalyticsAsync(Guid classId)
    {
        var enrollments = await db.Enrollments
            .Where(e => e.ClassId == classId)
            .Include(e => e.Student)
            .ThenInclude(u => u.QuizSubmissions)
            .ToListAsync();

        var students = enrollments.Select(e => new StudentAnalyticsDto
        {
            StudentId          = e.StudentId.ToString(),
            StudentName        = e.Student.Name,
            Email              = e.Student.Email,
            Avatar             = e.Student.AvatarInitials,
            CompletionPercent  = e.Progress,
            QuizzesTaken       = e.Student.QuizSubmissions.Count,
            AverageScore       = e.Student.QuizSubmissions.Any()
                ? (int)e.Student.QuizSubmissions.Average(s => s.Percentage)
                : 0,
            LastActive         = "N/A",
            EntryTestCompleted = e.EntryTestCompleted,
            WeakSkills         = []
        }).ToList();

        return new ClassAnalyticsDto
        {
            ClassId           = classId.ToString(),
            TotalStudents     = students.Count,
            AvgCompletion     = students.Any() ? (int)students.Average(s => s.CompletionPercent) : 0,
            NeedAttentionCount = students.Count(s => s.AverageScore < 50),
            Students          = students
        };
    }

    public async Task<StudentAnalyticsDto?> GetStudentAnalyticsAsync(Guid classId, Guid studentId)
    {
        var enrollment = await db.Enrollments
            .Where(e => e.ClassId == classId && e.StudentId == studentId)
            .Include(e => e.Student).ThenInclude(u => u.QuizSubmissions)
            .FirstOrDefaultAsync();

        if (enrollment == null) return null;

        return new StudentAnalyticsDto
        {
            StudentId          = studentId.ToString(),
            StudentName        = enrollment.Student.Name,
            Email              = enrollment.Student.Email,
            Avatar             = enrollment.Student.AvatarInitials,
            CompletionPercent  = enrollment.Progress,
            QuizzesTaken       = enrollment.Student.QuizSubmissions.Count,
            AverageScore       = enrollment.Student.QuizSubmissions.Any()
                ? (int)enrollment.Student.QuizSubmissions.Average(s => s.Percentage)
                : 0,
            LastActive         = "N/A",
            EntryTestCompleted = enrollment.EntryTestCompleted,
            WeakSkills         = []
        };
    }

    public async Task<StudentProgressDto> GetMyProgressAsync(Guid studentId)
    {
        var enrollments = await db.Enrollments
            .Where(e => e.StudentId == studentId)
            .Include(e => e.Class)
            .ToListAsync();

        var overallProgress = enrollments.Any()
            ? (int)enrollments.Average(e => e.Progress)
            : 0;

        return new StudentProgressDto
        {
            StudentId       = studentId.ToString(),
            OverallProgress = overallProgress,
            EnrolledClasses = enrollments.Select(e => new EnrolledClassProgressDto
            {
                ClassId            = e.ClassId.ToString(),
                ClassName          = e.Class.Name,
                CoverColor         = e.Class.CoverColor,
                Progress           = e.Progress,
                EntryTestCompleted = e.EntryTestCompleted,
                JoinedAt           = e.EnrolledAt.ToString("dd MMM yyyy")
            }).ToList()
        };
    }

    public async Task<StudentStatsDto> GetMyStatsAsync(Guid studentId)
    {
        var submissions = await db.QuizSubmissions
            .Where(s => s.StudentId == studentId)
            .ToListAsync();

        return new StudentStatsDto
        {
            DayStreak       = 0, // TODO: calculate streak from activity log
            AvgQuizScore    = submissions.Any() ? (int)submissions.Average(s => s.Percentage) : 0,
            TotalQuizzesTaken = submissions.Count,
            WeeklyProgress  = 0
        };
    }
}
