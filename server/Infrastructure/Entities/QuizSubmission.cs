namespace EduBoost.API.Infrastructure.Entities;

public class QuizSubmission
{
    public Guid Id { get; set; }
    public int Score { get; set; }
    public int TotalQuestions { get; set; }
    public double Percentage { get; set; }
    public string Grade { get; set; } = "";

    /// <summary>JSON blob — chi tiết từng câu trả lời + topic breakdown</summary>
    public string? AnswersJson { get; set; }

    public DateTime CompletedAt { get; set; } = DateTime.UtcNow;

    // FK
    public Guid StudentId { get; set; }
    public Guid QuizId { get; set; }

    // Navigation
    public User Student { get; set; } = null!;
    public Quiz Quiz { get; set; } = null!;
}
