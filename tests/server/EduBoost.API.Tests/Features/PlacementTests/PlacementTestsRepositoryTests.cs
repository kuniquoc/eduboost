using EduBoost.API.Features.LearningStates;
using EduBoost.API.Features.PlacementTests;
using EduBoost.API.Features.PlacementTests.Models;
using EduBoost.API.Features.Roadmap;
using EduBoost.API.Features.Roadmap.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class PlacementTestsRepositoryTests
{
    [Fact]
    public async Task StartAndSubmitAsync_UsesActiveEntryTestOrder_AndFixedTotalQuestions()
    {
        await using var db = CreateDb();
        var studentId = Guid.NewGuid();
        var teacherId = Guid.NewGuid();
        var classId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var quizId = Guid.NewGuid();

        db.Users.AddRange(
            new User { Id = studentId, Name = "Student", Email = "student@test.com", PasswordHash = "x", Role = "student" },
            new User { Id = teacherId, Name = "Teacher", Email = "teacher@test.com", PasswordHash = "x", Role = "teacher" });
        db.Classes.Add(new Class
        {
            Id = classId,
            Name = "Lớp A",
            TeacherId = teacherId,
            ClassCode = "CLS12345",
            ActiveEntryTestId = quizId,
            CreatedAt = DateTime.UtcNow
        });
        db.Enrollments.Add(new Enrollment { StudentId = studentId, ClassId = classId, EnrolledAt = DateTime.UtcNow });
        db.Topics.Add(new Topic { Id = topicId, Name = "Grammar", ClassId = classId, OwnerId = teacherId, Difficulty = "medium", CreatedAt = DateTime.UtcNow });
        db.Quizzes.Add(new Quiz
        {
            Id = quizId,
            ClassId = classId,
            TopicId = topicId,
            Title = "Entry test",
            Type = "entry_test",
            IsPublished = true
        });

        var q1 = CreateMcq(Guid.NewGuid(), quizId, "Question 1", 0);
        var q2 = CreateMcq(Guid.NewGuid(), quizId, "Question 2", 1);
        var q3 = CreateMcq(Guid.NewGuid(), quizId, "Question 3", 2);
        db.Questions.AddRange(q1, q2, q3);
        await db.SaveChangesAsync();

        var repo = CreateRepo(db);
        var start = await repo.StartTestAsync(studentId, classId);

        Assert.Equal(1, start.QuestionNumber);
        Assert.Equal(3, start.TotalQuestions);
        Assert.Equal("Question 1", start.Question.Text);

        var firstAnswer = await repo.SubmitAnswerAsync(studentId, new AnswerPlacementRequest
        {
            SessionId = start.SessionId,
            QuestionId = q1.Id.ToString(),
            SelectedOptionId = q1.Options.Single(o => o.IsCorrect).Id.ToString()
        });

        Assert.False(firstAnswer.IsComplete);
        Assert.Equal(2, firstAnswer.QuestionNumber);
        Assert.Equal(3, firstAnswer.TotalQuestions);
        Assert.Equal("Question 2", firstAnswer.NextQuestion!.Text);
    }

    [Fact]
    public async Task SubmitAnswerAsync_DoesNotEndEarly_WhenPoolStillHasRemainingQuestions()
    {
        await using var db = CreateDb();
        var studentId = Guid.NewGuid();
        var teacherId = Guid.NewGuid();
        var classId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var quizId = Guid.NewGuid();

        db.Users.AddRange(
            new User { Id = studentId, Name = "Student", Email = "student2@test.com", PasswordHash = "x", Role = "student" },
            new User { Id = teacherId, Name = "Teacher", Email = "teacher2@test.com", PasswordHash = "x", Role = "teacher" });
        db.Classes.Add(new Class
        {
            Id = classId,
            Name = "Lớp B",
            TeacherId = teacherId,
            ClassCode = "CLS67890",
            ActiveEntryTestId = quizId,
            CreatedAt = DateTime.UtcNow
        });
        db.Enrollments.Add(new Enrollment { StudentId = studentId, ClassId = classId, EnrolledAt = DateTime.UtcNow });
        db.Topics.Add(new Topic { Id = topicId, Name = "Vocabulary", ClassId = classId, OwnerId = teacherId, Difficulty = "medium", CreatedAt = DateTime.UtcNow });
        db.Quizzes.Add(new Quiz
        {
            Id = quizId,
            ClassId = classId,
            TopicId = topicId,
            Title = "Entry test 6 câu",
            Type = "entry_test",
            IsPublished = true
        });

        var questions = Enumerable.Range(1, 6)
            .Select(i => CreateMcq(Guid.NewGuid(), quizId, $"Question {i}", i - 1))
            .ToList();
        db.Questions.AddRange(questions);
        await db.SaveChangesAsync();

        var repo = CreateRepo(db);
        var start = await repo.StartTestAsync(studentId, classId);
        var sessionId = start.SessionId;
        AnswerPlacementResponse response = null!;

        foreach (var question in questions.Take(5))
        {
            response = await repo.SubmitAnswerAsync(studentId, new AnswerPlacementRequest
            {
                SessionId = sessionId,
                QuestionId = question.Id.ToString(),
                SelectedOptionId = question.Options.Single(o => o.IsCorrect).Id.ToString()
            });
        }

        Assert.False(response.IsComplete);
        Assert.Equal(6, response.TotalQuestions);
        Assert.Equal(6, response.QuestionNumber);
        Assert.Equal("Question 6", response.NextQuestion!.Text);
    }

    private static PlacementTestsRepository CreateRepo(AppDbContext db) =>
        new(db, new NoOpRoadmapRepository(), new LearningEvidenceService(db));

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static Question CreateMcq(Guid id, Guid quizId, string text, int orderIndex) => new()
    {
        Id = id,
        QuizId = quizId,
        Text = text,
        Type = "mcq",
        IrtItem = new IrtItem
        {
            Id = Guid.NewGuid(),
            InitialBeta = 0,
            Beta = 0
        },
        OrderIndex = orderIndex,
        Options =
        [
            new QuizOption { Id = Guid.NewGuid(), Text = "A", IsCorrect = true, OrderIndex = 0 },
            new QuizOption { Id = Guid.NewGuid(), Text = "B", IsCorrect = false, OrderIndex = 1 }
        ]
    };

    private sealed class NoOpRoadmapRepository : IRoadmapRepository
    {
        public Task<RoadmapDto?> GetByClassIdAsync(Guid classId, Guid studentId) => Task.FromResult<RoadmapDto?>(null);
        public Task<RoadmapDto> GenerateAsync(Guid classId, Guid studentId, string entryTestResultId) => throw new NotSupportedException();
        public Task<RoadmapStepDto?> UpdateStepAsync(Guid classId, Guid studentId, string stepId, UpdateStepRequest request) =>
            Task.FromResult<RoadmapStepDto?>(null);
        public Task SyncAfterLearningAsync(Guid classId, Guid userId, Guid topicId) => Task.CompletedTask;
        public Task EnsureClassTopicsSyncedAsync(Guid classId, Guid studentId) => Task.CompletedTask;
    }
}
