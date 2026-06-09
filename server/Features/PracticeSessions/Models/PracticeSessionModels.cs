using System.ComponentModel.DataAnnotations;

namespace EduBoost.API.Features.PracticeSessions.Models;

public class StartPracticeRequest
{
    public Guid? TopicId { get; set; }
    public int QuestionCount { get; set; } = 10;
    public string Mode { get; set; } = "standard";
    public List<Guid>? QuestionIds { get; set; }
}

public class StartReviewRequest
{
    public List<Guid>? QuestionIds { get; set; }
}

public class StartPracticeResponse
{
    public string SessionId { get; set; } = "";
    public string TopicName { get; set; } = "";
    public PracticeQuestionDto Question { get; set; } = null!;
    public int QuestionNumber { get; set; }
    public int TotalQuestions { get; set; }
}

public class PracticeQuestionDto
{
    public string QuestionId { get; set; } = "";
    public string Text { get; set; } = "";
    public string Type { get; set; } = "mcq";
    public string Difficulty { get; set; } = "medium";
    public List<PracticeOptionDto> Options { get; set; } = [];
}

public class PracticeOptionDto
{
    public string Id { get; set; } = "";
    public string Text { get; set; } = "";
}

public class SubmitAnswerRequest
{
    [Required] public string SessionId { get; set; } = "";
    [Required] public string QuestionId { get; set; } = "";
    public string? SelectedOptionId { get; set; }
    public List<string>? SelectedOptionIds { get; set; }
    public string? TextAnswer { get; set; }
    public double? ResponseTimeSeconds { get; set; }
}

public class SubmitAnswerResponse
{
    public bool IsCorrect { get; set; }
    public string? CorrectAnswer { get; set; }
    public string? Explanation { get; set; }
    public PracticeQuestionDto? NextQuestion { get; set; }
    public int QuestionNumber { get; set; }
    public bool IsSessionComplete { get; set; }
    public SrUpdateDto? SpacedRepetition { get; set; }
}

public class SrUpdateDto
{
    public string NextReviewDate { get; set; } = "";
    public double ReviewInterval { get; set; }
    public int RepetitionCount { get; set; }
    public bool IntervalChanged { get; set; }
    public double PreviousInterval { get; set; }
}

public class EndPracticeRequest
{
    [Required] public string SessionId { get; set; } = "";
}

public class PracticeSessionSummary
{
    public string SessionId { get; set; } = "";
    public string TopicName { get; set; } = "";
    public int QuestionsAttempted { get; set; }
    public int CorrectAnswers { get; set; }
    public double Score { get; set; }
    public double MasteryChange { get; set; }
    public string? Recommendation { get; set; }
    public int ItemsReviewed { get; set; }
    public string? NextReviewSummary { get; set; }
}
