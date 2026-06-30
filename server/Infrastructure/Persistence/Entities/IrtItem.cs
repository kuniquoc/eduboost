namespace EduBoost.API.Infrastructure.Entities;

public class IrtItem
{
    public Guid Id { get; set; }
    public double InitialBeta { get; set; }
    public double Beta { get; set; }
    public double? BetaStandardError { get; set; }
    public int CalibrationSampleCount { get; set; }
    public string PriorSource { get; set; } = "label";
    public string CalibrationStatus { get; set; } = "provisional";
    public DateTime? CalibratedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Question> Questions { get; set; } = [];
}
