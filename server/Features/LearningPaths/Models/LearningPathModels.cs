namespace EduBoost.API.Features.LearningPaths.Models;

public class LearningPathDto
{
    public List<LearningPathItemDto> Items { get; set; } = [];
    public int TotalItems { get; set; }
    public int CompletedItems { get; set; }
    public double OverallProgress { get; set; }
}

public class LearningPathItemDto
{
    public string Id { get; set; } = "";
    public string TopicId { get; set; } = "";
    public string TopicName { get; set; } = "";
    public string RecommendedDifficulty { get; set; } = "medium";
    public double PriorityScore { get; set; }
    public string? NextReviewDate { get; set; }
    public bool IsCompleted { get; set; }
    public int OrderIndex { get; set; }
}
