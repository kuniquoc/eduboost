namespace EduBoost.API.Infrastructure.Entities;

/// <summary>Bản ghi student đăng ký (join) một class.</summary>
public class Enrollment
{
    public Guid Id { get; set; }
    public DateTime EnrolledAt { get; set; } = DateTime.UtcNow;
    public bool EntryTestCompleted { get; set; }
    public int Progress { get; set; } // 0-100

    // FK
    public Guid StudentId { get; set; }
    public Guid ClassId { get; set; }

    // Navigation
    public User Student { get; set; } = null!;
    public Class Class { get; set; } = null!;
}
