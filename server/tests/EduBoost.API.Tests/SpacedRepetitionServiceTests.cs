using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Services;
using Xunit;

namespace EduBoost.API.Tests;

public class SpacedRepetitionServiceTests
{
    private readonly SpacedRepetitionService _service = new();

    [Theory]
    [InlineData(false, null, 1)]
    [InlineData(true, null, 4)]
    [InlineData(true, 3.0, 5)]
    [InlineData(true, 10.0, 4)]
    [InlineData(true, 20.0, 3)]
    public void ComputeQuality_MatchesPythonRules(bool isCorrect, double? responseTime, int expected)
    {
        Assert.Equal(expected, _service.ComputeQuality(isCorrect, responseTime));
    }

    [Fact]
    public void ApplyReview_FirstCorrectReview_SetsOneDayInterval()
    {
        var item = NewItem(repetitionCount: 0, reviewInterval: 1);

        var result = _service.ApplyReview(item, quality: 4, isCorrect: true);

        Assert.Equal(1, result.RepetitionCount);
        Assert.Equal(1, result.ReviewInterval);
        Assert.Equal(1, result.PreviousInterval);
    }

    [Fact]
    public void ApplyReview_SecondCorrectReview_SetsSixDayInterval()
    {
        var item = NewItem(repetitionCount: 1, reviewInterval: 1);

        var result = _service.ApplyReview(item, quality: 4, isCorrect: true);

        Assert.Equal(2, result.RepetitionCount);
        Assert.Equal(6, result.ReviewInterval);
    }

    [Fact]
    public void ApplyReview_IncorrectReview_ResetsRepetitions()
    {
        var item = NewItem(repetitionCount: 3, reviewInterval: 12, easeFactor: 2.5);

        var result = _service.ApplyReview(item, quality: 1, isCorrect: false);

        Assert.Equal(0, result.RepetitionCount);
        Assert.Equal(1, result.ReviewInterval);
        Assert.True(result.RetentionScore < 1.0);
    }

    [Fact]
    public void IsDueForReview_UsesTwelveHourLookahead()
    {
        var now = new DateTime(2026, 6, 9, 10, 0, 0, DateTimeKind.Utc);

        Assert.True(_service.IsDueForReview(now.AddHours(6), now));
        Assert.False(_service.IsDueForReview(now.AddHours(13), now));
    }

    private static SpacedRepetitionItem NewItem(int repetitionCount, double reviewInterval, double easeFactor = 2.5) =>
        new()
        {
            UserId = Guid.NewGuid(),
            QuestionId = Guid.NewGuid(),
            TopicId = Guid.NewGuid(),
            RepetitionCount = repetitionCount,
            ReviewInterval = reviewInterval,
            EaseFactor = easeFactor,
            RetentionScore = 0.5,
            LastReviewDate = DateTime.UtcNow.AddDays(-1),
            NextReviewDate = DateTime.UtcNow
        };
}
