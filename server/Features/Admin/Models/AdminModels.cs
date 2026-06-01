namespace EduBoost.API.Features.Admin.Models;

public class AdminUserDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Role { get; set; } = "";
    public string CreatedAt { get; set; } = "";
}

public class UpdateRoleRequest
{
    public string Role { get; set; } = ""; // "teacher" | "student" | "admin"
}

public class SystemStatsDto
{
    public int TotalUsers { get; set; }
    public int TotalStudents { get; set; }
    public int TotalTeachers { get; set; }
    public int TotalClasses { get; set; }
    public int TotalTopics { get; set; }
    public int TotalQuestions { get; set; }
    public int TotalLearningSessions { get; set; }
}
