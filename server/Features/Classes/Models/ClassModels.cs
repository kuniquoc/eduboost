using System.ComponentModel.DataAnnotations;

namespace EduBoost.API.Features.Classes.Models;

public class ClassDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string CoverColor { get; set; } = "#6366F1";
    public int StudentCount { get; set; }
    public int AverageProgress { get; set; }
    public int TopicCount { get; set; }
    public string ClassCode { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string TeacherId { get; set; } = "";
}

public class ClassDetailDto : ClassDto
{
    public List<TopicSummaryDto> Topics { get; set; } = [];
}

public class TopicSummaryDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Difficulty { get; set; } = "medium";
    public bool AiEvaluated { get; set; }
    public int QuestionCount { get; set; }
    public bool IsDocumentVisible { get; set; }
}

public class CreateClassRequest
{
    [Required, MinLength(3)] public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string CoverColor { get; set; } = "#6366F1";
}

public class UpdateClassRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? CoverColor { get; set; }
}

public class JoinClassRequest
{
    [Required] public string ClassCode { get; set; } = "";
}

public class EnrollStudentRequest
{
    [Required, EmailAddress] public string StudentEmail { get; set; } = "";
}
