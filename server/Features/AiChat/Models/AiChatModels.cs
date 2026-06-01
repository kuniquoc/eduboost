using System.ComponentModel.DataAnnotations;

namespace EduBoost.API.Features.AiChat.Models;

public class AskRequest
{
    [Required] public string Question { get; set; } = "";
    public Guid? TopicId { get; set; }
}

public class AskResponse
{
    public string Answer { get; set; } = "";
    public List<SourceReferenceDto> Sources { get; set; } = [];
    public string MessageId { get; set; } = "";
}

public class SourceReferenceDto
{
    public string DocumentId { get; set; } = "";
    public string FileName { get; set; } = "";
    public string? Snippet { get; set; }
}

public class ChatHistoryDto
{
    public List<ChatMessageDto> Messages { get; set; } = [];
    public int Total { get; set; }
}

public class ChatMessageDto
{
    public string Id { get; set; } = "";
    public string Role { get; set; } = "";
    public string Content { get; set; } = "";
    public List<SourceReferenceDto> Sources { get; set; } = [];
    public string CreatedAt { get; set; } = "";
}
