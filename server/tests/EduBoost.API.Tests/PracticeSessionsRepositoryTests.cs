using EduBoost.API.Features.LearningStates;
using EduBoost.API.Features.PracticeSessions;
using EduBoost.API.Features.PracticeSessions.Models;
using EduBoost.API.Features.Roadmap;
using EduBoost.API.Features.Roadmap.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class PracticeSessionsRepositoryTests
{
    [Fact]
    public async Task StartSessionAsync_FixedMode_UsesExactQuestionIdsWithoutDueFilter()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var quizId = Guid.NewGuid();
        var q1 = Guid.NewGuid();
        var q2 = Guid.NewGuid();

        db.Topics.Add(new Topic { Id = topicId, Name = "Pool Topic", OwnerId = userId });
        db.Quizzes.Add(new Quiz { Id = quizId, Title = "Pool batch", TopicId = topicId, Type = "pool" });
        db.Questions.AddRange(
            CreateMcq(q1, quizId, "Q1"),
            CreateMcq(q2, quizId, "Q2"));
        await db.SaveChangesAsync();

        var repo = CreateRepo(db);
        var response = await repo.StartSessionAsync(userId, new StartPracticeRequest
        {
            Mode = "fixed",
            TopicId = topicId,
            QuestionIds = [q2, q1]
        });

        Assert.Equal(2, response.TotalQuestions);
        Assert.Equal("Q2", response.Question.Text);

        var session = await db.PracticeActiveSessions.SingleAsync();
        Assert.Contains(q2.ToString(), session.StateJson);
        Assert.Contains(q1.ToString(), session.StateJson);
    }

    [Fact]
    public async Task SubmitAnswerAsync_UsesSourceTopicId_ForRevisionSetQuestion()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var sourceTopicId = Guid.NewGuid();
        var sessionTopicId = Guid.NewGuid();
        var revisionQuizId = Guid.NewGuid();
        var questionId = Guid.NewGuid();
        var optionId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();

        db.Topics.AddRange(
            new Topic { Id = sourceTopicId, Name = "Original topic", OwnerId = userId },
            new Topic { Id = sessionTopicId, Name = "Display topic", OwnerId = userId });
        db.Quizzes.Add(new Quiz
        {
            Id = revisionQuizId,
            Title = "Revision set",
            Type = "private",
            OwnerId = userId,
            IsPublished = true
        });
        db.Questions.Add(new Question
        {
            Id = questionId,
            QuizId = revisionQuizId,
            Text = "Copied question",
            SourceTopicId = sourceTopicId,
            Options = [new QuizOption { Id = optionId, Text = "A", IsCorrect = true, OrderIndex = 0 }]
        });
        db.PracticeActiveSessions.Add(new PracticeActiveSession
        {
            Id = sessionId,
            UserId = userId,
            StateJson = """
                {"UserId":"00000000-0000-0000-0000-000000000001","TopicId":"SESSION_TOPIC","TopicName":"Revision","Mode":"fixed","Questions":["QUESTION_ID"],"AffectedTopicIds":["SOURCE_TOPIC"],"CurrentIndex":0,"CorrectCount":0,"StartTime":"2026-01-01T00:00:00Z","MasteryBefore":0.3}
                """
                .Replace("SESSION_TOPIC", sessionTopicId.ToString())
                .Replace("QUESTION_ID", questionId.ToString())
                .Replace("SOURCE_TOPIC", sourceTopicId.ToString())
                .Replace("00000000-0000-0000-0000-000000000001", userId.ToString()),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(2)
        });
        await db.SaveChangesAsync();

        var repo = CreateRepo(db);
        await repo.SubmitAnswerAsync(userId, new SubmitAnswerRequest
        {
            SessionId = sessionId.ToString(),
            QuestionId = questionId.ToString(),
            SelectedOptionId = optionId.ToString(),
            ResponseTimeSeconds = 2
        });

        var bkt = await db.BktStates.SingleAsync(b => b.UserId == userId);
        Assert.Equal(sourceTopicId, bkt.TopicId);

        var sr = await db.SpacedRepetitionItems.SingleAsync(sr => sr.UserId == userId);
        Assert.Equal(sourceTopicId, sr.TopicId);
        Assert.Equal(questionId, sr.QuestionId);
    }

    [Fact]
    public async Task EndSessionAsync_CreatesLearningSession_AndUpdatesProfileStreak()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();

        db.Topics.Add(new Topic { Id = topicId, Name = "Algebra", OwnerId = userId });
        db.UserProfiles.Add(new UserProfile
        {
            UserId = userId,
            LearningStreak = 2,
            LastActiveDate = DateTime.UtcNow.AddDays(-1)
        });
        db.PracticeActiveSessions.Add(new PracticeActiveSession
        {
            Id = sessionId,
            UserId = userId,
            StateJson = $$"""
                {"UserId":"{{userId}}","TopicId":"{{topicId}}","TopicName":"Algebra","Mode":"fixed","Questions":[],"AffectedTopicIds":["{{topicId}}"],"CurrentIndex":3,"CorrectCount":2,"StartTime":"2026-01-01T00:00:00Z","MasteryBefore":0.3}
                """,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(2)
        });
        await db.SaveChangesAsync();

        var repo = CreateRepo(db);
        var summary = await repo.EndSessionAsync(userId, sessionId.ToString());

        Assert.Equal(3, summary.QuestionsAttempted);
        Assert.Equal(2, summary.CorrectAnswers);

        var learningSession = await db.LearningSessions.SingleAsync(ls => ls.UserId == userId);
        Assert.Equal(3, learningSession.QuestionsAttempted);

        var profile = await db.UserProfiles.SingleAsync(p => p.UserId == userId);
        Assert.Equal(3, profile.LearningStreak);
        Assert.Null(await db.PracticeActiveSessions.FindAsync(sessionId));
    }

    private static PracticeSessionsRepository CreateRepo(AppDbContext db) =>
        new(db, new LearningStatesRepository(db, new SpacedRepetitionService()), new NoOpRoadmapRepository());

    private static Question CreateMcq(Guid id, Guid quizId, string text) => new()
    {
        Id = id,
        QuizId = quizId,
        Text = text,
        Options = [new QuizOption { Id = Guid.NewGuid(), Text = "A", IsCorrect = true, OrderIndex = 0 }]
    };

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private sealed class NoOpRoadmapRepository : IRoadmapRepository
    {
        public Task<RoadmapDto?> GetByClassIdAsync(Guid classId, Guid studentId) => Task.FromResult<RoadmapDto?>(null);
        public Task<RoadmapDto> GenerateAsync(Guid classId, Guid studentId, string entryTestResultId) =>
            throw new NotSupportedException();
        public Task<RoadmapStepDto?> UpdateStepAsync(Guid classId, Guid studentId, string stepId, UpdateStepRequest request) =>
            Task.FromResult<RoadmapStepDto?>(null);
        public Task SyncAfterLearningAsync(Guid classId, Guid userId, Guid topicId) => Task.CompletedTask;
        public Task EnsureClassTopicsSyncedAsync(Guid classId, Guid studentId) => Task.CompletedTask;
    }
}
