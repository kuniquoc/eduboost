namespace EduBoost.API.Features.LearningStates.Models;

public class BktStateDto
{
    public string TopicId { get; set; } = "";
    public string TopicName { get; set; } = "";
    public double MasteryProbability { get; set; }
    public double GuessProbability { get; set; }
    public double SlipProbability { get; set; }
    public double TransitionProbability { get; set; }
    public double IrtTheta { get; set; }
    public string UpdatedAt { get; set; } = "";
}

public class UpdateBktRequest
{
    public Guid TopicId { get; set; }
    public Guid QuestionId { get; set; }
    public bool IsCorrect { get; set; }
    public double? ResponseTime { get; set; } // seconds
    public double? QuestionDifficultyIndex { get; set; }
}

public class UpdateBktResponse
{
    public BktStateDto State { get; set; } = null!;
    public string? Recommendation { get; set; }
    public double ThetaBefore { get; set; }
    public double ThetaAfter { get; set; }
    public double QuestionBeta { get; set; }
}

