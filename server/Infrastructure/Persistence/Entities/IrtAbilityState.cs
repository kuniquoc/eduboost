namespace EduBoost.API.Infrastructure.Entities;

public class IrtAbilityState
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TopicId { get; set; }
    public double Theta { get; set; }
    public double StandardError { get; set; } = 1.0;
    public int ResponseCount { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Topic Topic { get; set; } = null!;
}
