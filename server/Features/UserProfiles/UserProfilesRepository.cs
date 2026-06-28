using System.Text.Json;
using EduBoost.API.Features.UserProfiles.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.UserProfiles;

public interface IUserProfilesRepository
{
    Task<UserProfileDto> GetProfileAsync(Guid userId);
    Task<UserProfileDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request);
    Task<UserProfileDto?> GetProfileByUserIdAsync(Guid userId, Guid requesterId);
}

public class UserProfilesRepository(AppDbContext db, IStudentStatsCalculator statsCalculator) : IUserProfilesRepository
{
    public async Task<UserProfileDto> GetProfileAsync(Guid userId)
    {
        var profile = await db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile == null)
        {
            profile = new UserProfile { UserId = userId };
            db.UserProfiles.Add(profile);
            await db.SaveChangesAsync();
        }

        return await MapToDtoAsync(profile);
    }

    public async Task<UserProfileDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request)
    {
        var profile = await db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile == null)
        {
            profile = new UserProfile { UserId = userId };
            db.UserProfiles.Add(profile);
        }

        if (request.CurrentLevel != null)
            profile.CurrentLevel = request.CurrentLevel;

        if (request.PreferredTopics != null)
            profile.PreferredTopics = JsonSerializer.Serialize(request.PreferredTopics);

        profile.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return await MapToDtoAsync(profile);
    }

    public async Task<UserProfileDto?> GetProfileByUserIdAsync(Guid userId, Guid requesterId)
    {
        if (userId != requesterId)
        {
            var requester = await db.Users.FindAsync(requesterId);
            if (requester == null) return null;

            var canView = requester.Role == "admin"
                || (requester.Role == "teacher" && await db.Enrollments.AnyAsync(e =>
                    e.StudentId == userId
                    && e.Class.TeacherId == requesterId));

            if (!canView) return null;
        }

        var profile = await db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null) return null;
        return await MapToDtoAsync(profile);
    }

    private async Task<UserProfileDto> MapToDtoAsync(UserProfile profile)
    {
        var userId = profile.UserId;
        return new UserProfileDto
        {
            UserId = userId.ToString(),
            CurrentLevel = profile.CurrentLevel,
            OverallMasteryScore = await statsCalculator.CalculateOverallMasteryAsync(userId),
            TopicsStudiedCount = await statsCalculator.CalculateTopicsStudiedCountAsync(userId),
            PreferredTopics = string.IsNullOrEmpty(profile.PreferredTopics)
                ? []
                : JsonSerializer.Deserialize<List<string>>(profile.PreferredTopics) ?? [],
            LearningStreak = profile.LearningStreak,
            LastActiveDate = profile.LastActiveDate?.ToString("yyyy-MM-dd")
        };
    }
}
