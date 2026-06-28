namespace EduBoost.API.Infrastructure.Entities;

public class Topic
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Difficulty { get; set; } = "medium"; // "easy" | "medium" | "hard"
    public bool AiEvaluated { get; set; }
    public bool IsDocumentVisible { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // FK
    public Guid? ClassId { get; set; }
    public Guid? OwnerId { get; set; }

    // Navigation
    public Class? Class { get; set; }
    public User? Owner { get; set; }
    public ICollection<Quiz> Quizzes { get; set; } = [];
    public ICollection<Document> Documents { get; set; } = [];
}
