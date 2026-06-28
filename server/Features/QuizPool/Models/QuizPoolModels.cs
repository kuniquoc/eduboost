using System.ComponentModel.DataAnnotations;
using EduBoost.API.Features.Quizzes.Models;

namespace EduBoost.API.Features.QuizPool.Models;

public class GeneratePoolQuizRequest
{
    /// <summary>Existing topic ID — takes priority over TopicName when provided.</summary>
    public string? TopicId { get; set; }

    public string TopicName { get; set; } = "";
    
    public string? ClassId { get; set; }
    public string? UserSuggestion { get; set; }
    public string? DocumentId { get; set; }
    public int NumQuestions { get; set; } = 5;
    public string Difficulty { get; set; } = "medium";

    /// <summary>"append" (default) keeps existing questions; "replace" deletes all owner's pool quizzes in the topic first.</summary>
    public string Mode { get; set; } = "append";

    public int? NumEasyQuestions { get; set; }
    public int? NumMediumQuestions { get; set; }
    public int? NumHardQuestions { get; set; }
}

public class RenamePoolTopicRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MinLength(1)]
    public string Name { get; set; } = "";
}

public class RenamePoolQuizRequest
{
    [Required]
    [MinLength(1)]
    public string Name { get; set; } = "";
}

public class CreateTestFromPoolRequest
{
    [Required]
    public string Title { get; set; } = "";
    
    [Required]
    public string ClassId { get; set; } = "";
    
    public List<string> PoolQuizIds { get; set; } = [];

    public List<string> QuestionIds { get; set; } = [];
    
    public int TimeLimitMinutes { get; set; } = 45;
    public int TotalScore { get; set; } = 10;
}

public class CreateEntryTestFromPoolRequest
{
    [Required]
    public string ClassId { get; set; } = "";

    public string? Title { get; set; }

    public List<string> QuestionIds { get; set; } = [];

    public List<string> PoolQuizIds { get; set; } = [];
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
