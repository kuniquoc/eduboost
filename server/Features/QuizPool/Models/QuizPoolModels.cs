using System.ComponentModel.DataAnnotations;
using EduBoost.API.Features.Quizzes.Models;

namespace EduBoost.API.Features.QuizPool.Models;

public class GeneratePoolQuizRequest
{
    [Required]
    public string TopicName { get; set; } = "";
    
    public string? ClassId { get; set; }
    public string? UserSuggestion { get; set; }
    public string? DocumentId { get; set; }
    public int NumQuestions { get; set; } = 5;
    public string Difficulty { get; set; } = "medium";
}

public class CreateTestFromPoolRequest
{
    [Required]
    public string Title { get; set; } = "";
    
    [Required]
    public string ClassId { get; set; } = "";
    
    [Required]
    public List<string> PoolQuizIds { get; set; } = [];
    
    public int TimeLimitMinutes { get; set; } = 45;
    public int TotalScore { get; set; } = 10;
}

public class CreateRevisionSetFromPoolRequest
{
    [Required]
    public string Title { get; set; } = "";
    
    [Required]
    public List<string> PoolQuizIds { get; set; } = [];
}

public class TopicPoolDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Difficulty { get; set; } = "medium";
    public string? ClassId { get; set; }
    public string? OwnerId { get; set; }
    public int QuizCount { get; set; }
    public int QuestionCount { get; set; }
}

public class PoolQuizDetailDto
{
    public string QuizId { get; set; } = "";
    public string Title { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public List<QuestionDto> Questions { get; set; } = [];
}
