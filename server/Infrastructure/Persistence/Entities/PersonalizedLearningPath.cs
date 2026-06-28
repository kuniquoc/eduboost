namespace EduBoost.API.Infrastructure.Entities;

public class PersonalizedLearningPath
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TopicId { get; set; }
    public string RecommendedDifficulty { get; set; } = "medium"; // "easy" | "medium" | "hard"
    public double PriorityScore { get; set; }
    public DateTime? NextReviewDate { get; set; }
    public bool IsCompleted { get; set; }
    public int OrderIndex { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public Topic Topic { get; set; } = null!;
}
