using System.ComponentModel.DataAnnotations;

namespace EduBoost.API.Features.Topics.Models;

public class TopicDto
{
    public string Id { get; set; } = "";
    public string ClassId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Difficulty { get; set; } = "medium"; // "easy" | "medium" | "hard"
    public bool AiEvaluated { get; set; }
    public int QuestionCount { get; set; }
    public bool IsDocumentVisible { get; set; }
    public string CreatedAt { get; set; } = "";
}

public class CreateTopicRequest
{
    [Required, MinLength(2)] public string Name { get; set; } = "";
    public string Description { get; set; } = "";
}

public class UpdateTopicRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
}

public class UpdateDifficultyRequest
{
    [Required] public string Difficulty { get; set; } = "medium";
}

public class UpdateVisibilityRequest
{
    public bool IsDocumentVisible { get; set; }
}
