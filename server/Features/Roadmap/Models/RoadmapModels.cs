using System.ComponentModel.DataAnnotations;

namespace EduBoost.API.Features.Roadmap.Models;

public class RoadmapStepDto
{
    public string Id { get; set; } = "";
    public string TopicId { get; set; } = "";
    public string TopicName { get; set; } = "";
    public string Status { get; set; } = "in_progress"; // "completed" | "in_progress" | "recommended"
    public int Progress { get; set; }
    public string? Reason { get; set; }
    public double? Mastery { get; set; }
    public double? Theta { get; set; }
    public double? TopicBeta { get; set; }
    public int? DueCount { get; set; }
    public int OrderIndex { get; set; }
}

public class RoadmapDto
{
    public string ClassId { get; set; } = "";
    public string StudentId { get; set; } = "";
    public string GeneratedAt { get; set; } = "";
    public List<RoadmapStepDto> Steps { get; set; } = [];
}

public class GenerateRoadmapRequest
{
    [Required] public string EntryTestResultId { get; set; } = "";
}

public class UpdateStepRequest
{
    public int Progress { get; set; }
    public string Status { get; set; } = "";
}
