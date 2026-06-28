namespace EduBoost.API.Infrastructure.Entities;

public class BktState
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TopicId { get; set; }
    public double MasteryProbability { get; set; } = 0.3;
    public double GuessProbability { get; set; } = 0.40;
    public double SlipProbability { get; set; } = 0.20;
    public double TransitionProbability { get; set; } = 0.05;
    public double IrtTheta { get; set; } = 0.0;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public Topic Topic { get; set; } = null!;
}
