using EduBoost.API.Features.Students.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Students;

public interface IStudentsRepository
{
    Task<ClassAnalyticsDto> GetClassAnalyticsAsync(Guid classId);
    Task<StudentAnalyticsDto?> GetStudentAnalyticsAsync(Guid classId, Guid studentId);
    Task<StudentProgressDto> GetMyProgressAsync(Guid studentId);
    Task<StudentStatsDto> GetMyStatsAsync(Guid studentId);
}

public class StudentsRepository(AppDbContext db, IStudentStatsCalculator statsCalculator) : IStudentsRepository
{
    public async Task<ClassAnalyticsDto> GetClassAnalyticsAsync(Guid classId)
    {
        var cls = await db.Classes.FindAsync(classId);
        var topicIds = await db.Topics.Where(t => t.ClassId == classId).Select(t => t.Id).ToListAsync();

        var enrollments = await db.Enrollments
            .Where(e => e.ClassId == classId)
            .Include(e => e.Student)
            .ThenInclude(u => u.QuizSubmissions)
            .ToListAsync();

        var students = new List<StudentAnalyticsDto>();
        foreach (var e in enrollments)
        {
            students.Add(await BuildStudentAnalyticsAsync(classId, topicIds, e));
        }

        return new ClassAnalyticsDto
        {
            ClassId = classId.ToString(),
            ClassName = cls?.Name ?? "",
            TotalStudents = students.Count,
            AvgCompletion = students.Any() ? (int)students.Average(s => s.CompletionPercent) : 0,
            AvgScore = students.Any() ? (int)students.Average(s => s.AverageScore) : 0,
            StudentsCompleted = students.Count(s => s.CompletionPercent >= 80),
            NeedAttentionCount = students.Count(s => s.AverageScore < 50 || !s.EntryTestCompleted),
            Students = students
        };
    }

    public async Task<StudentAnalyticsDto?> GetStudentAnalyticsAsync(Guid classId, Guid studentId)
    {
        var topicIds = await db.Topics.Where(t => t.ClassId == classId).Select(t => t.Id).ToListAsync();
        var enrollment = await db.Enrollments
            .Where(e => e.ClassId == classId && e.StudentId == studentId)
            .Include(e => e.Student).ThenInclude(u => u.QuizSubmissions)
            .FirstOrDefaultAsync();

        if (enrollment == null) return null;
        return await BuildStudentAnalyticsAsync(classId, topicIds, enrollment);
    }

    public async Task<StudentProgressDto> GetMyProgressAsync(Guid studentId)
    {
        var enrollments = await db.Enrollments
            .Where(e => e.StudentId == studentId)
            .Include(e => e.Class)
            .ToListAsync();

        var classProgress = new List<int>();
        var enrolledClasses = new List<EnrolledClassProgressDto>();

        foreach (var e in enrollments)
        {
            var progress = await statsCalculator.CalculateClassProgressAsync(studentId, e.ClassId);
            classProgress.Add(progress);
            enrolledClasses.Add(new EnrolledClassProgressDto
            {
                ClassId = e.ClassId.ToString(),
                ClassName = e.Class.Name,
                CoverColor = e.Class.CoverColor,
                Progress = progress,
                EntryTestCompleted = e.EntryTestCompleted,
                JoinedAt = e.EnrolledAt.ToString("dd MMM yyyy")
            });
        }

        var overallProgress = classProgress.Any()
            ? (int)classProgress.Average()
            : 0;

        return new StudentProgressDto
        {
            StudentId = studentId.ToString(),
            OverallProgress = overallProgress,
            EnrolledClasses = enrolledClasses
        };
    }

    public async Task<StudentStatsDto> GetMyStatsAsync(Guid studentId)
    {
        var activity = await statsCalculator.CalculateActivityStatsAsync(studentId);
        var dayStreak = await statsCalculator.CalculateDayStreakAsync(studentId);

        return new StudentStatsDto
        {
            DayStreak = dayStreak,
            AvgQuizScore = activity.AvgQuizScore,
            TotalQuizzesTaken = activity.TotalQuizzesTaken,
            WeeklyProgress = activity.WeeklyProgress
        };
    }

    private async Task<StudentAnalyticsDto> BuildStudentAnalyticsAsync(
        Guid classId, List<Guid> topicIds, Infrastructure.Entities.Enrollment enrollment)
    {
        var studentId = enrollment.StudentId;
        var classQuizIds = await db.Quizzes
            .Where(q => q.ClassId == classId || (q.TopicId != null && topicIds.Contains(q.TopicId.Value)))
            .Select(q => q.Id)
            .ToListAsync();

        var classSubmissions = enrollment.Student.QuizSubmissions
            .Where(s => classQuizIds.Contains(s.QuizId))
            .ToList();

        var classQuizzes = await db.Quizzes
            .Where(q => classQuizIds.Contains(q.Id))
            .Select(q => new { q.Id, q.Title })
            .ToListAsync();

        var quizAttemptStats = classSubmissions
            .GroupBy(s => s.QuizId)
            .Select(g =>
            {
                var quiz = classQuizzes.FirstOrDefault(q => q.Id == g.Key);
                var correct = g.Sum(s => s.Score);
                var total = g.Sum(s => s.TotalQuestions);
                return new QuizAttemptStatDto
                {
                    QuizId = g.Key.ToString(),
                    QuizTitle = quiz?.Title ?? "Quiz",
                    AttemptCount = g.Count(),
                    CorrectCount = correct,
                    TotalQuestions = total,
                    CorrectRatio = total > 0 ? (double)correct / total : 0
                };
            })
            .OrderByDescending(s => s.AttemptCount)
            .ToList();

        var totalCorrect = classSubmissions.Sum(s => s.Score);
        var totalQuestions = classSubmissions.Sum(s => s.TotalQuestions);
        var correctRatio = totalQuestions > 0 ? (double)totalCorrect / totalQuestions : 0;

        var topics = await db.Topics
            .Where(t => topicIds.Contains(t.Id))
            .ToListAsync();

        var bktStates = await db.BktStates
            .Where(b => b.UserId == studentId && topicIds.Contains(b.TopicId))
            .ToListAsync();

        var topicMasteries = topics.Select(t =>
        {
            var state = bktStates.FirstOrDefault(b => b.TopicId == t.Id);
            return new TopicMasteryDto
            {
                TopicId = t.Id.ToString(),
                TopicName = t.Name,
                MasteryProbability = state?.MasteryProbability ?? 0.3,
                IrtTheta = state?.IrtTheta ?? 0
            };
        }).OrderBy(t => t.MasteryProbability).ToList();

        var weakBkt = topicMasteries
            .Where(t => t.MasteryProbability < 0.5)
            .Take(3)
            .ToList();

        var lastSession = await db.LearningSessions
            .Where(s => s.UserId == studentId && topicIds.Contains(s.TopicId))
            .OrderByDescending(s => s.StartTime)
            .Select(s => (DateTime?)s.StartTime)
            .FirstOrDefaultAsync();

        var lastQuiz = classSubmissions
            .OrderByDescending(s => s.CompletedAt)
            .Select(s => (DateTime?)s.CompletedAt)
            .FirstOrDefault();

        var lastActive = new[] { lastSession, lastQuiz, enrollment.Student.CreatedAt }
            .Where(d => d.HasValue)
            .Max()
            ?.ToString("yyyy-MM-dd") ?? "N/A";

        return new StudentAnalyticsDto
        {
            StudentId = studentId.ToString(),
            StudentName = enrollment.Student.Name,
            Email = enrollment.Student.Email,
            Avatar = enrollment.Student.AvatarUrl ?? enrollment.Student.AvatarInitials,
            CompletionPercent = enrollment.Progress,
            QuizzesTaken = classSubmissions.Count,
            AverageScore = classSubmissions.Any()
                ? (int)classSubmissions.Average(s => s.Percentage)
                : 0,
            CorrectRatio = correctRatio,
            QuizAttemptStats = quizAttemptStats,
            TopicMasteries = topicMasteries,
            LastActive = lastActive,
            EntryTestCompleted = enrollment.EntryTestCompleted,
            WeakSkills = weakBkt.Select(b => new WeakSkillDto
            {
                TopicId = b.TopicId,
                TopicName = b.TopicName,
                Score = (int)(b.MasteryProbability * 100)
            }).ToList()
        };
    }

}
