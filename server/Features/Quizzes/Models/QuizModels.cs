using System.ComponentModel.DataAnnotations;

namespace EduBoost.API.Features.Quizzes.Models;

public class OptionDto
{
    public string Id { get; set; } = "";
    public string Text { get; set; } = "";
    public bool IsCorrect { get; set; }
}

public class QuestionDto
{
    public string Id { get; set; } = "";
    public string QuizId { get; set; } = "";
    public string TopicId { get; set; } = "";
    public string Text { get; set; } = "";
    public string Type { get; set; } = "mcq"; // "mcq" | "multi_select" | "fill_blank"
    public string Difficulty { get; set; } = "medium";
    public List<OptionDto> Options { get; set; } = [];
    public string? CorrectAnswer { get; set; }
    public string? Explanation { get; set; }
    public bool VerifiedByTeacher { get; set; }
    public int OrderIndex { get; set; }
}

public class QuizDto
{
    public string Id { get; set; } = "";
    public string ClassId { get; set; } = "";
    public string? TopicId { get; set; }
    public string? DocumentId { get; set; }
    public string Title { get; set; } = "";
    public string Type { get; set; } = "practice"; // "entry_test" | "practice" | "private"
    public bool IsPublished { get; set; }
    public int QuestionCount { get; set; }
    public string CreatedAt { get; set; } = "";
}

public class UpdateQuestionRequest
{
    public string? Text { get; set; }
    public List<OptionDto>? Options { get; set; }
    public string? CorrectAnswer { get; set; }
    public string? Explanation { get; set; }
}

public class VerifyQuestionRequest
{
    public bool Verified { get; set; }
}

public class SubmitAnswerDto
{
    [Required] public string QuestionId { get; set; } = "";
    public List<string> SelectedOptionIds { get; set; } = [];
    public string? FillBlankValue { get; set; }
    public int TimeSpentSeconds { get; set; }
}

public class SubmitQuizRequest
{
    [Required] public List<SubmitAnswerDto> Answers { get; set; } = [];
}

public class TopicScoreDto
{
    public string TopicId { get; set; } = "";
    public string TopicName { get; set; } = "";
    public int Score { get; set; }
    public int Total { get; set; }
    public double Percentage { get; set; }
}

public class QuizResultDto
{
    public string QuizId { get; set; } = "";
    public int Score { get; set; }
    public int Total { get; set; }
    public double Percentage { get; set; }
    public string Grade { get; set; } = "";
    public List<TopicScoreDto> TopicScores { get; set; } = [];
    public string CompletedAt { get; set; } = "";
}

public class EntryTestDto
{
    public string QuizId { get; set; } = "";
    public string ClassId { get; set; } = "";
    public string ClassName { get; set; } = "";
    public List<QuestionDto> Questions { get; set; } = [];
}

// ── Manual Quiz Creation ──────────────────────────────────────────

public class CreateQuizRequest
{
    [Required] public string Title { get; set; } = "";
    public string? ClassId { get; set; }
    public string? TopicId { get; set; }
    public string Type { get; set; } = "practice"; // "practice" | "entry_test"
    [Required] public List<CreateQuestionRequest> Questions { get; set; } = [];
}

public class CreateQuestionRequest
{
    [Required] public string Text { get; set; } = "";
    public string Type { get; set; } = "mcq"; // "mcq" | "multi_select" | "fill_blank"
    public string Difficulty { get; set; } = "medium";
    public string? Explanation { get; set; }
    public string? CorrectAnswer { get; set; }
    public List<OptionDto> Options { get; set; } = [];
}
