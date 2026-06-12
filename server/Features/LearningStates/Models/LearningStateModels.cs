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
    public SrUpdateDto? SpacedRepetition { get; set; }
    public double ThetaBefore { get; set; }
    public double ThetaAfter { get; set; }
    public double QuestionBeta { get; set; }
}

public class SrUpdateDto
{
    public string NextReviewDate { get; set; } = "";
    public double ReviewInterval { get; set; }
    public int RepetitionCount { get; set; }
    public bool IntervalChanged { get; set; }
    public double PreviousInterval { get; set; }
}

public class ReviewScheduleDto
{
    public List<ReviewItemDto> Items { get; set; } = [];
    public int TotalDueToday { get; set; }
}

public class ReviewItemDto
{
    public string QuestionId { get; set; } = "";
    public string TopicId { get; set; } = "";
    public string TopicName { get; set; } = "";
    public string QuestionText { get; set; } = "";
    public string NextReviewDate { get; set; } = "";
    public string? LastReviewDate { get; set; }
    public double RetentionScore { get; set; }
    public int RepetitionCount { get; set; }
    public double ReviewInterval { get; set; }
    public double EaseFactor { get; set; }
    public double? OverdueHours { get; set; }
}
