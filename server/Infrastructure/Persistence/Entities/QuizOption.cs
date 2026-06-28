namespace EduBoost.API.Infrastructure.Entities;

public class QuizOption
{
    public Guid Id { get; set; }
    public string Text { get; set; } = "";
    public bool IsCorrect { get; set; }
    public int OrderIndex { get; set; }

    // FK
    public Guid QuestionId { get; set; }

    // Navigation
    public Question Question { get; set; } = null!;
}
