namespace EduBoost.API.Infrastructure.Entities;

public class PlacementTestSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid? ClassId { get; set; }
    public string StateJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }

    public User User { get; set; } = null!;
}
