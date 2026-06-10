using System.ComponentModel.DataAnnotations;
using EduBoost.API.Features.Quizzes;
using EduBoost.API.Features.Quizzes.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EduBoost.API.Tests;

public class TutorPracticeTests
{
    [Fact]
    public async Task CompleteTutorPracticeAsync_CreatesLearningSession_AndUpdatesStreak()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var topicId = Guid.NewGuid();

        db.Topics.Add(new Topic { Id = topicId, Name = "Algebra", OwnerId = userId });
        db.UserProfiles.Add(new UserProfile
        {
            UserId = userId,
            LearningStreak = 1,
            LastActiveDate = DateTime.UtcNow.AddDays(-1),
        });
        await db.SaveChangesAsync();

        var repo = new QuizzesRepository(db, null!, null!, null!, null!);
        await repo.CompleteTutorPracticeAsync(userId, topicId, 5, 4);

        var session = await db.LearningSessions.SingleAsync(ls => ls.UserId == userId);
        Assert.Equal(5, session.QuestionsAttempted);
        Assert.Equal(4, session.CorrectAnswers);

        var profile = await db.UserProfiles.SingleAsync(p => p.UserId == userId);
        Assert.Equal(2, profile.LearningStreak);
    }

    [Fact]
    public void TutorAnswerRequest_WithoutCorrectAnswer_IsValid()
    {
        var request = new TutorAnswerRequest
        {
            TopicId = Guid.NewGuid().ToString(),
            QuestionId = Guid.NewGuid().ToString(),
            QuestionText = "She ___ to school every day.",
            SelectedAnswer = "B",
            Difficulty = 0.42
        };

        var results = new List<ValidationResult>();
        var isValid = Validator.TryValidateObject(request, new ValidationContext(request), results, true);

        Assert.True(isValid);
        Assert.DoesNotContain(results, r => r.MemberNames.Contains(nameof(TutorAnswerRequest.CorrectAnswer)));
    }

    [Fact]
    public async Task PersistTutorQuestionAsync_StoresCorrectOption_ForServerSideScoring()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var topicId = Guid.NewGuid();

        db.Topics.Add(new Topic { Id = topicId, Name = "English Grammar", OwnerId = userId });
        await db.SaveChangesAsync();

        var repo = new QuizzesRepository(db, null!, null!, null!, null!);
        var questionId = await repo.PersistTutorQuestionAsync(topicId, new AgentQuizResponse
        {
            Question = "She ___ to school every day.",
            Options = new Dictionary<string, string>
            {
                ["A"] = "go",
                ["B"] = "goes",
                ["C"] = "going",
                ["D"] = "gone"
            },
            CorrectAnswer = "B",
            Explanation = "Vì chủ ngữ là She...",
            DifficultyLevel = 0.42
        });

        var question = await repo.GetTutorQuestionAsync(topicId, questionId);

        Assert.NotNull(question);
        Assert.Equal("goes", question!.CorrectAnswer);
        Assert.Equal("goes", question.Options.Single(o => o.IsCorrect).Text);
        Assert.False(question.Options[0].IsCorrect);
        Assert.True(question.Options[1].IsCorrect);
    }

    [Fact]
    public async Task GetRecentTutorQuestionTextsAsync_ReturnsOnlyTutorQuestionsForTopic()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var otherTopicId = Guid.NewGuid();

        db.Topics.AddRange(
            new Topic { Id = topicId, Name = "English Grammar", OwnerId = userId },
            new Topic { Id = otherTopicId, Name = "Vocabulary", OwnerId = userId });
        await db.SaveChangesAsync();

        var repo = new QuizzesRepository(db, null!, null!, null!, null!);
        await repo.PersistTutorQuestionAsync(topicId, CreateAgentQuestion("She ___ to school every day."));
        await repo.PersistTutorQuestionAsync(topicId, CreateAgentQuestion("He ___ to work every day."));
        await repo.PersistTutorQuestionAsync(otherTopicId, CreateAgentQuestion("They ___ at home."));

        var poolQuizId = Guid.NewGuid();
        db.Quizzes.Add(new Quiz
        {
            Id = poolQuizId,
            TopicId = topicId,
            Title = "Pool quiz",
            Type = "pool",
            CreatedAt = DateTime.UtcNow
        });
        db.Questions.Add(new Question
        {
            Id = Guid.NewGuid(),
            QuizId = poolQuizId,
            Text = "Pool question should be ignored.",
            Type = "mcq",
            Difficulty = "easy",
            CorrectAnswer = "A",
            OrderIndex = 0
        });
        await db.SaveChangesAsync();

        var texts = await repo.GetRecentTutorQuestionTextsAsync(topicId, limit: 1);

        Assert.Single(texts);
        Assert.Equal("He ___ to work every day.", texts[0]);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static AgentQuizResponse CreateAgentQuestion(string question)
    {
        return new AgentQuizResponse
        {
            Question = question,
            Options = new Dictionary<string, string>
            {
                ["A"] = "go",
                ["B"] = "goes",
                ["C"] = "going",
                ["D"] = "gone"
            },
            CorrectAnswer = "A",
            Explanation = "Sample explanation",
            DifficultyLevel = 0.42
        };
    }
}
