using System.ComponentModel.DataAnnotations;

namespace EduBoost.API.Features.PlacementTests.Models;

public class StartPlacementTestResponse
{
    public string SessionId { get; set; } = "";
    public PlacementQuestionDto Question { get; set; } = null!;
    public int QuestionNumber { get; set; }
    public int TotalQuestions { get; set; }
}

public class PlacementQuestionDto
{
    public string QuestionId { get; set; } = "";
    public string Text { get; set; } = "";
    public string Type { get; set; } = "mcq";
    public string Difficulty { get; set; } = "medium";
    public List<PlacementOptionDto> Options { get; set; } = [];
}

public class PlacementOptionDto
{
    public string Id { get; set; } = "";
    public string Text { get; set; } = "";
}

public class AnswerPlacementRequest
{
    [Required] public string SessionId { get; set; } = "";
    [Required] public string QuestionId { get; set; } = "";
    public string? SelectedOptionId { get; set; }
    public string? TextAnswer { get; set; } // for fill_blank
}

public class AnswerPlacementResponse
{
    public bool IsCorrect { get; set; }
    public bool IsComplete { get; set; }
    public PlacementQuestionDto? NextQuestion { get; set; }
    public int QuestionNumber { get; set; }
    public int TotalQuestions { get; set; }
}

public class CompletePlacementResponse
{
    public string ResultId { get; set; } = "";
    public string InitialLevel { get; set; } = "";
    public double FinalScore { get; set; }
    public List<TopicStrengthDto> Strengths { get; set; } = [];
    public List<TopicStrengthDto> Weaknesses { get; set; } = [];
}

public class TopicStrengthDto
{
    public string TopicId { get; set; } = "";
    public string TopicName { get; set; } = "";
    public double Score { get; set; }
}

public class PlacementTestResultDto
{
    public string Id { get; set; } = "";
    public string InitialLevel { get; set; } = "";
    public double FinalScore { get; set; }
    public List<TopicStrengthDto> Strengths { get; set; } = [];
    public List<TopicStrengthDto> Weaknesses { get; set; } = [];
    public string CreatedAt { get; set; } = "";
}
