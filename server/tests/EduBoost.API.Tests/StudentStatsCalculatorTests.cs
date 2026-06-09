using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class StudentStatsCalculatorTests
{
    private readonly Guid _studentId = Guid.NewGuid();

    [Fact]
    public async Task CalculateActivityStatsAsync_NoActivity_ReturnsZeros()
    {
        await using var db = CreateDb();
        var calc = new StudentStatsCalculator(db);

        var stats = await calc.CalculateActivityStatsAsync(_studentId);

        Assert.Equal(0, stats.AvgQuizScore);
        Assert.Equal(0, stats.TotalQuizzesTaken);
        Assert.Equal(0, stats.WeeklyProgress);
    }

    [Fact]
    public async Task CalculateActivityStatsAsync_QuizAndSession_ComputesWeightedAverageAndTotal()
    {
        await using var db = CreateDb();
        db.QuizSubmissions.Add(new QuizSubmission
        {
            StudentId = _studentId,
            QuizId = Guid.NewGuid(),
            Score = 8,
            TotalQuestions = 10,
            Percentage = 80,
            CompletedAt = DateTime.UtcNow
        });
        db.LearningSessions.Add(new LearningSession
        {
            UserId = _studentId,
            TopicId = Guid.NewGuid(),
            QuestionsAttempted = 10,
            CorrectAnswers = 5,
            Score = 50,
            StartTime = DateTime.UtcNow,
            EndTime = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var calc = new StudentStatsCalculator(db);
        var stats = await calc.CalculateActivityStatsAsync(_studentId);

        Assert.Equal(65, stats.AvgQuizScore);
        Assert.Equal(2, stats.TotalQuizzesTaken);
    }

    [Fact]
    public async Task CalculateActivityStatsAsync_WeeklyProgress_ExcludesPreviousWeek()
    {
        await using var db = CreateDb();
        var weekStart = StudentStatsCalculator.GetUtcWeekStart(DateTime.UtcNow);

        db.QuizSubmissions.AddRange(
            new QuizSubmission
            {
                StudentId = _studentId,
                QuizId = Guid.NewGuid(),
                Score = 10,
                TotalQuestions = 10,
                Percentage = 100,
                CompletedAt = weekStart.AddHours(1)
            },
            new QuizSubmission
            {
                StudentId = _studentId,
                QuizId = Guid.NewGuid(),
                Score = 0,
                TotalQuestions = 10,
                Percentage = 0,
                CompletedAt = weekStart.AddDays(-1)
            });
        await db.SaveChangesAsync();

        var calc = new StudentStatsCalculator(db);
        var stats = await calc.CalculateActivityStatsAsync(_studentId);

        Assert.Equal(100, stats.WeeklyProgress);
    }

    [Fact]
    public async Task CalculateTopicsStudiedCountAsync_CountsDistinctBktTopics()
    {
        await using var db = CreateDb();
        var topic1 = Guid.NewGuid();
        var topic2 = Guid.NewGuid();

        db.BktStates.AddRange(
            new BktState { UserId = _studentId, TopicId = topic1, MasteryProbability = 0.4 },
            new BktState { UserId = _studentId, TopicId = topic2, MasteryProbability = 0.6 },
            new BktState { UserId = Guid.NewGuid(), TopicId = topic1, MasteryProbability = 0.9 });

        await db.SaveChangesAsync();

        var calc = new StudentStatsCalculator(db);
        var count = await calc.CalculateTopicsStudiedCountAsync(_studentId);

        Assert.Equal(2, count);
    }

    [Fact]
    public async Task CalculateOverallMasteryAsync_AveragesBktProbabilities()
    {
        await using var db = CreateDb();
        db.BktStates.AddRange(
            new BktState { UserId = _studentId, TopicId = Guid.NewGuid(), MasteryProbability = 0.4 },
            new BktState { UserId = _studentId, TopicId = Guid.NewGuid(), MasteryProbability = 0.8 });

        await db.SaveChangesAsync();

        var calc = new StudentStatsCalculator(db);
        var mastery = await calc.CalculateOverallMasteryAsync(_studentId);

        Assert.Equal(0.6, mastery, precision: 5);
    }

    [Fact]
    public async Task CalculateDayStreakAsync_CountsConsecutiveUtcDays()
    {
        await using var db = CreateDb();
        var today = DateTime.UtcNow.Date;

        db.LearningSessions.AddRange(
            new LearningSession
            {
                UserId = _studentId,
                TopicId = Guid.NewGuid(),
                StartTime = today,
                QuestionsAttempted = 1,
                CorrectAnswers = 1
            },
            new LearningSession
            {
                UserId = _studentId,
                TopicId = Guid.NewGuid(),
                StartTime = today.AddDays(-1),
                QuestionsAttempted = 1,
                CorrectAnswers = 1
            },
            new LearningSession
            {
                UserId = _studentId,
                TopicId = Guid.NewGuid(),
                StartTime = today.AddDays(-2),
                QuestionsAttempted = 1,
                CorrectAnswers = 1
            },
            new LearningSession
            {
                UserId = _studentId,
                TopicId = Guid.NewGuid(),
                StartTime = today.AddDays(-4),
                QuestionsAttempted = 1,
                CorrectAnswers = 1
            });

        await db.SaveChangesAsync();

        var calc = new StudentStatsCalculator(db);
        var streak = await calc.CalculateDayStreakAsync(_studentId);

        Assert.Equal(3, streak);
    }

    [Fact]
    public async Task CalculateClassProgressAsync_UsesCompletedRoadmapSteps()
    {
        await using var db = CreateDb();
        var classId = Guid.NewGuid();
        var topic1 = Guid.NewGuid();
        var topic2 = Guid.NewGuid();

        db.Topics.AddRange(
            new Topic { Id = topic1, Name = "A", ClassId = classId },
            new Topic { Id = topic2, Name = "B", ClassId = classId });

        db.PersonalizedLearningPaths.AddRange(
            new PersonalizedLearningPath { UserId = _studentId, TopicId = topic1, IsCompleted = true, OrderIndex = 0 },
            new PersonalizedLearningPath { UserId = _studentId, TopicId = topic2, IsCompleted = false, OrderIndex = 1 });

        await db.SaveChangesAsync();

        var calc = new StudentStatsCalculator(db);
        var progress = await calc.CalculateClassProgressAsync(_studentId, classId);

        Assert.Equal(50, progress);
    }

    [Fact]
    public void GetUtcWeekStart_ReturnsMondayAtMidnightUtc()
    {
        var wednesday = new DateTime(2026, 6, 10, 15, 30, 0, DateTimeKind.Utc);
        var weekStart = StudentStatsCalculator.GetUtcWeekStart(wednesday);

        Assert.Equal(DayOfWeek.Monday, weekStart.DayOfWeek);
        Assert.Equal(new DateTime(2026, 6, 8, 0, 0, 0, DateTimeKind.Utc), weekStart);
    }

    private AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
