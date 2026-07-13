using System.Data;
using EduBoost.API.Features.Admin.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Integrations.Agent;
using EduBoost.API.Infrastructure.Integrations.Storage;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Admin;

public interface IAdminRepository
{
    Task<List<AdminUserDto>> GetUsersAsync(string? search, string? role);
    Task<bool> UpdateRoleAsync(Guid userId, string role);
    Task<DeleteUserResult> DeleteUserAsync(Guid userId, Guid actingAdminId);
    Task<SystemStatsDto> GetStatsAsync();
}

public enum DeleteUserResult
{
    Deleted,
    NotFound,
    SelfDeletionForbidden,
    LastAdminForbidden
}

public class AdminRepository(
    AppDbContext db,
    IAgentService agent,
    IStorageService storage,
    ILogger<AdminRepository> logger) : IAdminRepository
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

    public async Task<DeleteUserResult> DeleteUserAsync(Guid userId, Guid actingAdminId)
    {
        if (userId == actingAdminId) return DeleteUserResult.SelfDeletionForbidden;

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var user = await db.Users.FindAsync(userId);
        if (user == null) return DeleteUserResult.NotFound;

        if (user.Role == "admin" && await db.Users.CountAsync(u => u.Role == "admin") <= 1)
            return DeleteUserResult.LastAdminForbidden;

        var documents = await db.Documents
            .Where(d => d.OwnerId == userId || (d.Class != null && d.Class.TeacherId == userId))
            .Select(d => new DocumentCleanupInfo(d.Id, d.Scope, d.StorageKey))
            .ToListAsync();

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        await CleanupExternalAssetsAsync(userId, documents);
        return DeleteUserResult.Deleted;
    }

    private async Task CleanupExternalAssetsAsync(Guid userId, List<DocumentCleanupInfo> documents)
    {
        foreach (var document in documents)
        {
            try
            {
                await agent.DeleteDocumentAsync(document.Id.ToString());
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not delete RAG vectors for document {DocumentId} after deleting user {UserId}", document.Id, userId);
            }

            if (document.StorageKey is null) continue;

            try
            {
                var bucket = document.Scope == "class"
                    ? MinioStorageService.Buckets.ClassDocuments
                    : MinioStorageService.Buckets.StudentDocuments;
                await storage.DeleteObjectAsync(bucket, document.StorageKey);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not delete stored file for document {DocumentId} after deleting user {UserId}", document.Id, userId);
            }
        }

        foreach (var extension in new[] { ".jpg", ".png", ".webp", ".gif" })
        {
            try
            {
                await storage.DeleteObjectAsync(
                    MinioStorageService.Buckets.StudentDocuments,
                    $"avatars/{userId}{extension}");
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not delete avatar candidate {Extension} after deleting user {UserId}", extension, userId);
            }
        }
    }

    private sealed record DocumentCleanupInfo(Guid Id, string Scope, string? StorageKey);

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
