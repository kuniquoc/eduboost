using EduBoost.API.Infrastructure.Entities;

namespace EduBoost.API.Infrastructure.Services;

public record SpacedRepetitionUpdateResult(
    double ReviewInterval,
    double EaseFactor,
    int RepetitionCount,
    DateTime NextReviewDate,
    double RetentionScore,
    bool IntervalChanged,
    double PreviousInterval);

public interface ISpacedRepetitionService
{
    int ComputeQuality(bool isCorrect, double? responseTimeSeconds);
    SpacedRepetitionUpdateResult ApplyReview(SpacedRepetitionItem item, int quality, bool isCorrect);
    bool IsDueForReview(DateTime nextReviewDate, DateTime? referenceUtc = null);
}

public class SpacedRepetitionService : ISpacedRepetitionService
{
    private static readonly TimeSpan DueLookahead = TimeSpan.FromHours(12);

    public int ComputeQuality(bool isCorrect, double? responseTimeSeconds)
    {
        if (!isCorrect)
            return 1;

        if (responseTimeSeconds is null)
            return 4;

        if (responseTimeSeconds < 5)
            return 5;
        if (responseTimeSeconds < 15)
            return 4;

        return 3;
    }

    public SpacedRepetitionUpdateResult ApplyReview(SpacedRepetitionItem item, int quality, bool isCorrect)
    {
        quality = Math.Clamp(quality, 0, 5);
        var previousInterval = item.ReviewInterval;

        if (quality >= 3)
        {
            if (item.RepetitionCount == 0)
                item.ReviewInterval = 1;
            else if (item.RepetitionCount == 1)
                item.ReviewInterval = 6;
            else
                item.ReviewInterval = item.ReviewInterval * item.EaseFactor;

            item.RepetitionCount++;
        }
        else
        {
            item.RepetitionCount = 0;
            item.ReviewInterval = 1;
        }

        item.EaseFactor = Math.Max(1.3, item.EaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
        item.RetentionScore = isCorrect
            ? Math.Min(1.0, item.RetentionScore + 0.1)
            : Math.Max(0.0, item.RetentionScore - 0.2);
        item.LastReviewDate = DateTime.UtcNow;
        item.NextReviewDate = DateTime.UtcNow.AddDays(item.ReviewInterval);

        return new SpacedRepetitionUpdateResult(
            item.ReviewInterval,
            item.EaseFactor,
            item.RepetitionCount,
            item.NextReviewDate,
            item.RetentionScore,
            Math.Abs(item.ReviewInterval - previousInterval) > 0.001,
            previousInterval);
    }

    public bool IsDueForReview(DateTime nextReviewDate, DateTime? referenceUtc = null)
    {
        var now = referenceUtc ?? DateTime.UtcNow;
        return nextReviewDate <= now.Add(DueLookahead);
    }
}
