using EduBoost.API.Features.Admin.Models;
using EduBoost.API.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Admin;

public interface IAdminRepository
{
    Task<List<AdminUserDto>> GetUsersAsync(string? search, string? role);
    Task<bool> UpdateRoleAsync(Guid userId, string role);
    Task<bool> DeleteUserAsync(Guid userId);
    Task<SystemStatsDto> GetStatsAsync();
}

public class AdminRepository(AppDbContext db) : IAdminRepository
{
    private static readonly HashSet<string> ValidRoles = ["student", "teacher", "admin"];

    public async Task<List<AdminUserDto>> GetUsersAsync(string? search, string? role)
    {
        var query = db.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(u => u.Name.Contains(search) || u.Email.Contains(search));

        if (!string.IsNullOrWhiteSpace(role))
            query = query.Where(u => u.Role == role);

        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Take(100)
            .ToListAsync();

        return users.Select(u => new AdminUserDto
        {
            Id = u.Id.ToString(),
            Name = u.Name,
            Email = u.Email,
            Role = u.Role,
            CreatedAt = u.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")
        }).ToList();
    }

    public async Task<bool> UpdateRoleAsync(Guid userId, string role)
    {
        if (!ValidRoles.Contains(role)) return false;

        var user = await db.Users.FindAsync(userId);
        if (user == null) return false;

        user.Role = role;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteUserAsync(Guid userId)
    {
        var user = await db.Users.FindAsync(userId);
        if (user == null) return false;

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<SystemStatsDto> GetStatsAsync()
    {
        return new SystemStatsDto
        {
            TotalUsers = await db.Users.CountAsync(),
            TotalStudents = await db.Users.CountAsync(u => u.Role == "student"),
            TotalTeachers = await db.Users.CountAsync(u => u.Role == "teacher"),
            TotalClasses = await db.Classes.CountAsync(),
            TotalTopics = await db.Topics.CountAsync(),
            TotalQuestions = await db.Questions.CountAsync(),
            TotalLearningSessions = await db.LearningSessions.CountAsync()
        };
    }
}
