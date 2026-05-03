namespace EduBoost.API.Infrastructure.Entities;

public class Quiz
{
    public Guid Id { get; set; }
    public string Title { get; set; } = "";

    /// <summary>"entry_test" | "practice" | "private"</summary>
    public string Type { get; set; } = "practice";

    public bool IsPublished { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // FK
    public Guid? ClassId { get; set; }
    public Guid? TopicId { get; set; }

    // Navigation
    public Class? Class { get; set; }
    public Topic? Topic { get; set; }
    public ICollection<Question> Questions { get; set; } = [];
    public ICollection<Document> GeneratedFromDocuments { get; set; } = [];
    public ICollection<QuizSubmission> Submissions { get; set; } = [];
}
