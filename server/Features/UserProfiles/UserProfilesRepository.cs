using System.Text.Json;
using EduBoost.API.Features.UserProfiles.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.UserProfiles;

public interface IUserProfilesRepository
{
    Task<UserProfileDto> GetProfileAsync(Guid userId);
    Task<UserProfileDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request);
    Task<UserProfileDto?> GetProfileByUserIdAsync(Guid userId, Guid requesterId);
}

public class UserProfilesRepository(AppDbContext db) : IUserProfilesRepository
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

        return MapToDto(profile);
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

        return MapToDto(profile);
    }

    public async Task<UserProfileDto?> GetProfileByUserIdAsync(Guid userId, Guid requesterId)
    {
        var profile = await db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null) return null;
        return MapToDto(profile);
    }

    private static UserProfileDto MapToDto(UserProfile profile) => new()
    {
        UserId = profile.UserId.ToString(),
        CurrentLevel = profile.CurrentLevel,
        OverallMasteryScore = profile.OverallMasteryScore,
        PreferredTopics = string.IsNullOrEmpty(profile.PreferredTopics)
            ? []
            : JsonSerializer.Deserialize<List<string>>(profile.PreferredTopics) ?? [],
        LearningStreak = profile.LearningStreak,
        LastActiveDate = profile.LastActiveDate?.ToString("yyyy-MM-dd")
    };
}
