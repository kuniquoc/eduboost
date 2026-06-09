using EduBoost.API.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Infrastructure.Services;

public record StudentActivityStats(int AvgQuizScore, int TotalQuizzesTaken, int WeeklyProgress);

public interface IStudentStatsCalculator
{
    Task<StudentActivityStats> CalculateActivityStatsAsync(Guid studentId);
    Task<int> CalculateTopicsStudiedCountAsync(Guid studentId);
    Task<double> CalculateOverallMasteryAsync(Guid studentId);
    Task<int> CalculateDayStreakAsync(Guid studentId);
    Task<int> CalculateClassProgressAsync(Guid studentId, Guid classId);
}

public class StudentStatsCalculator(AppDbContext db) : IStudentStatsCalculator
{
    public async Task<StudentActivityStats> CalculateActivityStatsAsync(Guid studentId)
    {
        var submissions = await db.QuizSubmissions
            .Where(s => s.StudentId == studentId)
            .Select(s => new { s.Score, s.TotalQuestions, s.CompletedAt })
            .ToListAsync();

        var sessions = await db.LearningSessions
            .Where(s => s.UserId == studentId)
            .Select(s => new { s.CorrectAnswers, s.QuestionsAttempted, s.StartTime, s.EndTime })
            .ToListAsync();

        var totalCorrect = submissions.Sum(s => s.Score) + sessions.Sum(s => s.CorrectAnswers);
        var totalAttempted = submissions.Sum(s => s.TotalQuestions) + sessions.Sum(s => s.QuestionsAttempted);

        var avgQuizScore = totalAttempted > 0
            ? (int)(totalCorrect * 100.0 / totalAttempted)
            : 0;

        var totalQuizzesTaken = submissions.Count + sessions.Count;

        var weekStart = GetUtcWeekStart(DateTime.UtcNow);
        var weeklyCorrect = submissions
            .Where(s => s.CompletedAt >= weekStart)
            .Sum(s => s.Score)
            + sessions
                .Where(s => (s.EndTime ?? s.StartTime) >= weekStart)
                .Sum(s => s.CorrectAnswers);

        var weeklyAttempted = submissions
            .Where(s => s.CompletedAt >= weekStart)
            .Sum(s => s.TotalQuestions)
            + sessions
                .Where(s => (s.EndTime ?? s.StartTime) >= weekStart)
                .Sum(s => s.QuestionsAttempted);

        var weeklyProgress = weeklyAttempted > 0
            ? (int)Math.Round(weeklyCorrect * 100.0 / weeklyAttempted)
            : 0;

        return new StudentActivityStats(avgQuizScore, totalQuizzesTaken, weeklyProgress);
    }

    public async Task<int> CalculateTopicsStudiedCountAsync(Guid studentId) =>
        await db.BktStates
            .Where(b => b.UserId == studentId)
            .Select(b => b.TopicId)
            .Distinct()
            .CountAsync();

    public async Task<double> CalculateOverallMasteryAsync(Guid studentId)
    {
        var avg = await db.BktStates
            .Where(b => b.UserId == studentId)
            .AverageAsync(b => (double?)b.MasteryProbability);

        return avg ?? 0.0;
    }

    public async Task<int> CalculateDayStreakAsync(Guid studentId)
    {
        var sessionDates = await db.LearningSessions
            .Where(s => s.UserId == studentId)
            .Select(s => s.StartTime.Date)
            .Distinct()
            .ToListAsync();

        var submissionDates = await db.QuizSubmissions
            .Where(s => s.StudentId == studentId)
            .Select(s => s.CompletedAt.Date)
            .Distinct()
            .ToListAsync();

        var activeDates = sessionDates
            .Concat(submissionDates)
            .Distinct()
            .ToHashSet();

        if (activeDates.Count == 0) return 0;

        var streak = 0;
        var day = DateTime.UtcNow.Date;

        while (activeDates.Contains(day))
        {
            streak++;
            day = day.AddDays(-1);
        }

        return streak;
    }

    public async Task<int> CalculateClassProgressAsync(Guid studentId, Guid classId)
    {
        var paths = await db.PersonalizedLearningPaths
            .Where(p => p.UserId == studentId && p.Topic.ClassId == classId)
            .Select(p => p.IsCompleted)
            .ToListAsync();

        if (paths.Count == 0) return 0;

        var completed = paths.Count(p => p);
        return (int)Math.Round(completed * 100.0 / paths.Count);
    }

    public static DateTime GetUtcWeekStart(DateTime utcNow)
    {
        var day = utcNow.Date;
        var daysFromMonday = ((int)day.DayOfWeek + 6) % 7;
        return day.AddDays(-daysFromMonday);
    }
}
