namespace EduBoost.API.Infrastructure.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "student"; // "teacher" | "student"
    public string? AvatarInitials { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<Class> TaughtClasses { get; set; } = [];
    public ICollection<Enrollment> Enrollments { get; set; } = [];
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
    public ICollection<Document> Documents { get; set; } = [];
    public ICollection<QuizSubmission> QuizSubmissions { get; set; } = [];
}
