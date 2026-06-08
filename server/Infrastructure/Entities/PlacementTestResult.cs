namespace EduBoost.API.Infrastructure.Entities;

public class PlacementTestResult
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid? ClassId { get; set; }
    public string InitialLevel { get; set; } = "beginner"; // "beginner" | "intermediate" | "advanced"
    public double FinalScore { get; set; }
    public string? StrengthsJson { get; set; } // JSON: topic scores
    public string? WeaknessesJson { get; set; } // JSON: topic scores
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
}
