namespace EduBoost.API.Infrastructure.Entities;

public class Document
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = "";
    public string FileSize { get; set; } = "";

    /// <summary>MinIO object key (bucket-relative path)</summary>
    public string? StorageKey { get; set; }

    /// <summary>"pending" | "ready" | "processing" | "error"</summary>
    public string Status { get; set; } = "pending";

    /// <summary>"class" | "student" — xác định bucket và quyền truy cập</summary>
    public string Scope { get; set; } = "class";

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    // FK
    public Guid OwnerId { get; set; }
    public Guid? ClassId { get; set; }
    public Guid? TopicId { get; set; }
    public Guid? GeneratedQuizId { get; set; }

    // Navigation
    public User Owner { get; set; } = null!;
    public Class? Class { get; set; }
    public Topic? Topic { get; set; }
    public Quiz? GeneratedQuiz { get; set; }
}
