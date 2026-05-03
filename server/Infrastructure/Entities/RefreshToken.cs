namespace EduBoost.API.Infrastructure.Entities;

/// <summary>JWT Refresh Token — stored in DB for rotation &amp; revocation.</summary>
public class RefreshToken
{
    public Guid Id { get; set; }
    public string Token { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? ReplacedByToken { get; set; }

    // FK
    public Guid UserId { get; set; }

    // Navigation
    public User User { get; set; } = null!;
}
