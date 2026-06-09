using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Infrastructure;

/// <summary>
/// Ensures a configured admin user exists on startup (idempotent).
/// </summary>
public static class AdminBootstrap
{
    public static async Task EnsureAsync(AppDbContext db, IConfiguration config, ILogger logger)
    {
        var email = config["SeedAdmin:Email"];
        var password = config["SeedAdmin:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogInformation("SeedAdmin not configured, skipping admin bootstrap.");
            return;
        }

        if (await db.Users.AnyAsync(u => u.Email == email))
        {
            logger.LogInformation("Admin user {Email} already exists, skipping.", email);
            return;
        }

        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Name = "Admin",
            Email = email.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = "admin",
            AvatarInitials = "AD",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        logger.LogInformation("Admin user {Email} created.", email);
    }
}
