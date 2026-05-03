namespace EduBoost.API.Infrastructure.Entities;

public class Class
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string CoverColor { get; set; } = "#6366F1";
    public string ClassCode { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // FK
    public Guid TeacherId { get; set; }

    // Navigation
    public User Teacher { get; set; } = null!;
    public ICollection<Enrollment> Enrollments { get; set; } = [];
    public ICollection<Topic> Topics { get; set; } = [];
    public ICollection<Document> Documents { get; set; } = [];
    public ICollection<Quiz> Quizzes { get; set; } = [];
}
