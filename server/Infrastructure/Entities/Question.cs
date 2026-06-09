namespace EduBoost.API.Infrastructure.Entities;

public class Question
{
    public Guid Id { get; set; }
    public string Text { get; set; } = "";

    /// <summary>"mcq" | "multi_select" | "fill_blank"</summary>
    public string Type { get; set; } = "mcq";

    public string Difficulty { get; set; } = "medium";
    public string? Explanation { get; set; }
    public string? CorrectAnswer { get; set; } // for fill_blank
    public bool VerifiedByTeacher { get; set; }
    public int OrderIndex { get; set; }

    // FK
    public Guid QuizId { get; set; }
    public Guid? SourceDocumentId { get; set; }
    /// <summary>Original topic when copied into a private revision set (Quiz.TopicId is null).</summary>
    public Guid? SourceTopicId { get; set; }

    // Navigation
    public Quiz Quiz { get; set; } = null!;
    public Document? SourceDocument { get; set; }
    public Topic? SourceTopic { get; set; }
    public ICollection<QuizOption> Options { get; set; } = [];
    public ICollection<SpacedRepetitionItem> SpacedRepetitionItems { get; set; } = [];
}
