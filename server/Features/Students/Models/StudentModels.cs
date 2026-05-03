namespace EduBoost.API.Features.Students.Models;

public class WeakSkillDto
{
    public string TopicId { get; set; } = "";
    public string TopicName { get; set; } = "";
    public int Score { get; set; }
}

public class StudentAnalyticsDto
{
    public string StudentId { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Avatar { get; set; }
    public int CompletionPercent { get; set; }
    public int QuizzesTaken { get; set; }
    public int AverageScore { get; set; }
    public List<WeakSkillDto> WeakSkills { get; set; } = [];
    public string LastActive { get; set; } = "";
    public bool EntryTestCompleted { get; set; }
}

public class ClassAnalyticsDto
{
    public string ClassId { get; set; } = "";
    public int TotalStudents { get; set; }
    public int AvgCompletion { get; set; }
    public int NeedAttentionCount { get; set; }
    public List<StudentAnalyticsDto> Students { get; set; } = [];
}

public class StudentProgressDto
{
    public string StudentId { get; set; } = "";
    public int OverallProgress { get; set; }
    public List<EnrolledClassProgressDto> EnrolledClasses { get; set; } = [];
}

public class EnrolledClassProgressDto
{
    public string ClassId { get; set; } = "";
    public string ClassName { get; set; } = "";
    public string CoverColor { get; set; } = "";
    public int Progress { get; set; }
    public bool EntryTestCompleted { get; set; }
    public string JoinedAt { get; set; } = "";
}

public class StudentStatsDto
{
    public int DayStreak { get; set; }
    public int AvgQuizScore { get; set; }
    public int TotalQuizzesTaken { get; set; }
    public int WeeklyProgress { get; set; }
}
