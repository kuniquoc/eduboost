namespace EduBoost.API.Features.Students.Models;

public class WeakSkillDto
{
    public string TopicId { get; set; } = "";
    public string TopicName { get; set; } = "";
    public int Score { get; set; }
}

public class QuizAttemptStatDto
{
    public string QuizId { get; set; } = "";
    public string QuizTitle { get; set; } = "";
    public int AttemptCount { get; set; }
    public int CorrectCount { get; set; }
    public int TotalQuestions { get; set; }
    public double CorrectRatio { get; set; }
}

public class TopicMasteryDto
{
    public string TopicId { get; set; } = "";
    public string TopicName { get; set; } = "";
    public double MasteryProbability { get; set; }
    public double IrtTheta { get; set; }
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
    public double CorrectRatio { get; set; }
    public List<WeakSkillDto> WeakSkills { get; set; } = [];
    public List<QuizAttemptStatDto> QuizAttemptStats { get; set; } = [];
    public List<TopicMasteryDto> TopicMasteries { get; set; } = [];
    public string LastActive { get; set; } = "";
    public bool EntryTestCompleted { get; set; }
}

public class ClassAnalyticsDto
{
    public string ClassId { get; set; } = "";
    public string ClassName { get; set; } = "";
    public int TotalStudents { get; set; }
    public int AvgCompletion { get; set; }
    public int AvgScore { get; set; }
    public int StudentsCompleted { get; set; }
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
