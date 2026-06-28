namespace EduBoost.API.Infrastructure.Entities;

public class LearningSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TopicId { get; set; }
    public DateTime StartTime { get; set; } = DateTime.UtcNow;
    public DateTime? EndTime { get; set; }
    public int QuestionsAttempted { get; set; }
    public int CorrectAnswers { get; set; }
    public double Score { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public Topic Topic { get; set; } = null!;
}
