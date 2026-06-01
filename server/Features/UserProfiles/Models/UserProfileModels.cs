namespace EduBoost.API.Features.UserProfiles.Models;

public class UserProfileDto
{
    public string UserId { get; set; } = "";
    public string CurrentLevel { get; set; } = "beginner";
    public double OverallMasteryScore { get; set; }
    public List<string> PreferredTopics { get; set; } = [];
    public int LearningStreak { get; set; }
    public string? LastActiveDate { get; set; }
}

public class UpdateProfileRequest
{
    public string? CurrentLevel { get; set; }
    public List<string>? PreferredTopics { get; set; }
}
