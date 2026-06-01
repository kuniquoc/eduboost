namespace EduBoost.API.Infrastructure.Entities;

public class UserProfile
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string CurrentLevel { get; set; } = "beginner"; // "beginner" | "intermediate" | "advanced"
    public double OverallMasteryScore { get; set; } = 0.0;
    public string? PreferredTopics { get; set; } // JSON array of topic IDs
    public int LearningStreak { get; set; } = 0;
    public DateTime? LastActiveDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
}
