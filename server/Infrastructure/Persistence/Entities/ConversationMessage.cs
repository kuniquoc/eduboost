namespace EduBoost.API.Infrastructure.Entities;

public class ConversationMessage
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid? TopicId { get; set; }
    public string Role { get; set; } = "user"; // "user" | "assistant"
    public string Content { get; set; } = "";
    public string? SourceReferencesJson { get; set; } // JSON: document references
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public Topic? Topic { get; set; }
}
