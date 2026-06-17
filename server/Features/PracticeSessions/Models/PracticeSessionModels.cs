using System.ComponentModel.DataAnnotations;

namespace EduBoost.API.Features.PracticeSessions.Models;

public class StartPracticeRequest
{
    public Guid? TopicId { get; set; }
    public Guid? ClassId { get; set; }
    public Guid? QuizId { get; set; }
    public int QuestionCount { get; set; } = 10;
    public string Mode { get; set; } = "standard";
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
    public double DifficultyIndex { get; set; }
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
    public bool FeedbackSuppressed { get; set; }
    public bool IsCorrect { get; set; }
    public string? CorrectAnswer { get; set; }
    public string? Explanation { get; set; }
    public PracticeQuestionDto? NextQuestion { get; set; }
    public int QuestionNumber { get; set; }
    public int TotalQuestions { get; set; }
    public bool IsSessionComplete { get; set; }
    public string? AgentAction { get; set; }
    public string? AgentReason { get; set; }
    public string? AgentExplanation { get; set; }
    public bool RecommendNextSkill { get; set; }
    public string? NextSkillSuggestion { get; set; }
    public double? ThetaBefore { get; set; }
    public double? ThetaAfter { get; set; }
    public double? QuestionBeta { get; set; }
    public double? TargetBeta { get; set; }
    public double? SessionMastery { get; set; }
    public double? DbMasteryBaseline { get; set; }
    public string? SuggestedNextTopicId { get; set; }
    public string? SuggestedNextTopicName { get; set; }
}

public class QuizReviewItemDto
{
    public string QuestionId { get; set; } = "";
    public string Text { get; set; } = "";
    public string Type { get; set; } = "mcq";
    public List<PracticeOptionDto> Options { get; set; } = [];
    public string? SelectedOptionId { get; set; }
    public string? CorrectOptionId { get; set; }
    public string? CorrectAnswer { get; set; }
    public bool IsCorrect { get; set; }
    public string? Explanation { get; set; }
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
    public List<QuizReviewItemDto>? ReviewItems { get; set; }
}
