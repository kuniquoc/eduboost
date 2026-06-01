namespace EduBoost.API.Infrastructure.Entities;

public class SpacedRepetitionItem
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid QuestionId { get; set; }
    public Guid TopicId { get; set; }
    public DateTime LastReviewDate { get; set; }
    public DateTime NextReviewDate { get; set; }
    public double ReviewInterval { get; set; } = 1.0; // days
    public double EaseFactor { get; set; } = 2.5;
    public double RetentionScore { get; set; } = 0.0;
    public int RepetitionCount { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public Question Question { get; set; } = null!;
    public Topic Topic { get; set; } = null!;
}
