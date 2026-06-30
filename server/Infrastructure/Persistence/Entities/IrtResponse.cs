namespace EduBoost.API.Infrastructure.Entities;

public class IrtResponse
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TopicId { get; set; }
    public Guid IrtItemId { get; set; }
    public Guid QuestionId { get; set; }
    public bool IsCorrect { get; set; }
    public double BetaAtResponse { get; set; }
    public string Source { get; set; } = "practice";
    public Guid AttemptId { get; set; }
    public int Sequence { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Topic Topic { get; set; } = null!;
    public IrtItem IrtItem { get; set; } = null!;
}
