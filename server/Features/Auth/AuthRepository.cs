using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using EduBoost.API.Features.Auth.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace EduBoost.API.Features.Auth;

public interface IAuthRepository
{
    /// <summary>Throw UnauthorizedAccessException với message cụ thể nếu thất bại</summary>
    Task<AuthTokensDto> LoginAsync(string email, string password);
    Task<AuthTokensDto> RegisterAsync(RegisterRequest request);
    Task<UserDto?> UpdateNameAsync(Guid userId, string name);
    Task<UserDto?> UpdateAvatarAsync(Guid userId, Stream imageStream, string contentType);
    Task<UserDto?> GetByIdAsync(Guid userId);
    Task<AuthTokensDto?> RefreshTokenAsync(string refreshToken);
    Task<bool> RevokeTokenAsync(string refreshToken);
}

public class AuthRepository(AppDbContext db, IConfiguration config, IStorageService storage) : IAuthRepository
{
    private readonly string _jwtSecret    = config["Jwt:Secret"]    ?? throw new InvalidOperationException("Jwt:Secret missing");
    private readonly string _jwtIssuer    = config["Jwt:Issuer"]    ?? "EduBoost";
    private readonly string _jwtAudience  = config["Jwt:Audience"]  ?? "EduBoost";
    private readonly int    _accessExpiry = int.TryParse(config["Jwt:AccessTokenExpiryMinutes"], out var m) ? m : 60;
    private readonly int    _refreshExpiry = int.TryParse(config["Jwt:RefreshTokenExpiryDays"], out var d) ? d : 30;

    // ── Login ─────────────────────────────────────────────────────────────────
    public async Task<AuthTokensDto> LoginAsync(string email, string password)
    {
        var user = await db.Users
            .SingleOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());

        if (user == null)
            throw new UnauthorizedAccessException("Email này chưa được đăng ký trong hệ thống");

        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            throw new UnauthorizedAccessException("Mật khẩu không chính xác");

        return await GenerateTokensAsync(user);
    }

    // ── Register ──────────────────────────────────────────────────────────────
    public async Task<AuthTokensDto> RegisterAsync(RegisterRequest request)
    {
        if (!string.Equals(request.Role, "student", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Chỉ có thể tự đăng ký tài khoản học sinh. Liên hệ quản trị viên để tạo tài khoản giáo viên.");

        if (await db.Users.AnyAsync(u => u.Email.ToLower() == request.Email.ToLower()))
            throw new InvalidOperationException("Email này đã được đăng ký trong hệ thống");

        var initials = string.Concat(
            request.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                        .Take(2)
                        .Select(w => char.ToUpper(w[0])));

        var user = new User
        {
            Id           = Guid.NewGuid(),
            Name         = request.Name,
            Email        = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role         = "student",
            AvatarInitials = initials,
            CreatedAt    = DateTime.UtcNow
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return await GenerateTokensAsync(user);
    }

    public async Task<UserDto?> UpdateAvatarAsync(Guid userId, Stream imageStream, string contentType)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null) return null;

        const string bucket = MinioStorageService.Buckets.StudentDocuments;
        await storage.EnsureBucketExistsAsync(bucket);

        var objectKey = $"avatars/{userId}{GetExtensionFromContentType(contentType)}";
        await storage.UploadObjectAsync(bucket, objectKey, imageStream, contentType);

        var publicUrl = await storage.GetPresignedDownloadUrlAsync(bucket, objectKey, 86400 * 7);
        user.AvatarUrl = publicUrl;
        await db.SaveChangesAsync();
        return MapToDto(user);
    }

    public async Task<UserDto?> UpdateNameAsync(Guid userId, string name)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null) return null;

        user.Name = name.Trim();
        user.AvatarInitials = string.Concat(
            user.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                     .Take(2)
                     .Select(w => char.ToUpper(w[0])));
        await db.SaveChangesAsync();
        return MapToDto(user);
    }

    // ── Get by ID ─────────────────────────────────────────────────────────────
    public async Task<UserDto?> GetByIdAsync(Guid userId)
    {
        var user = await db.Users.FindAsync(userId);
        return user is null ? null : MapToDto(user);
    }

    // ── Refresh Token ─────────────────────────────────────────────────────────
    public async Task<AuthTokensDto?> RefreshTokenAsync(string refreshToken)
    {
        var token = await db.RefreshTokens
            .Include(r => r.User)
            .SingleOrDefaultAsync(r => r.Token == refreshToken);

        if (token is null || token.IsRevoked || token.ExpiresAt < DateTime.UtcNow)
            return null;

        // Rotate: mark old as revoked, issue new
        var newRefreshRaw = GenerateSecureToken();
        token.IsRevoked       = true;
        token.ReplacedByToken = newRefreshRaw;

        var newRefreshToken = new RefreshToken
        {
            Id        = Guid.NewGuid(),
            Token     = newRefreshRaw,
            UserId    = token.UserId,
            ExpiresAt = DateTime.UtcNow.AddDays(_refreshExpiry),
            CreatedAt = DateTime.UtcNow
        };

        db.RefreshTokens.Add(newRefreshToken);
        await db.SaveChangesAsync();

        var accessToken = GenerateAccessToken(token.User);
        return new AuthTokensDto
        {
            AccessToken  = accessToken,
            RefreshToken = newRefreshRaw,
            User         = MapToDto(token.User)
        };
    }

    // ── Revoke Token ──────────────────────────────────────────────────────────
    public async Task<bool> RevokeTokenAsync(string refreshToken)
    {
        var token = await db.RefreshTokens
            .SingleOrDefaultAsync(r => r.Token == refreshToken);

        if (token is null || token.IsRevoked) return false;

        token.IsRevoked = true;
        await db.SaveChangesAsync();
        return true;
    }

    // ── Private helpers ───────────────────────────────────────────────────────
    private async Task<AuthTokensDto> GenerateTokensAsync(User user)
    {
        var accessToken  = GenerateAccessToken(user);
        var refreshRaw   = GenerateSecureToken();

        // Revoke any old active refresh tokens for user (optional: keep last N)
        var oldTokens = await db.RefreshTokens
            .Where(r => r.UserId == user.Id && !r.IsRevoked && r.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();
        oldTokens.ForEach(t => t.IsRevoked = true);

        var refreshToken = new RefreshToken
        {
            Id        = Guid.NewGuid(),
            Token     = refreshRaw,
            UserId    = user.Id,
            ExpiresAt = DateTime.UtcNow.AddDays(_refreshExpiry),
            CreatedAt = DateTime.UtcNow
        };

        db.RefreshTokens.Add(refreshToken);
        await db.SaveChangesAsync();

        return new AuthTokensDto
        {
            AccessToken  = accessToken,
            RefreshToken = refreshRaw,
            User         = MapToDto(user)
        };
    }

    private string GenerateAccessToken(User user)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("name", user.Name),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer:    _jwtIssuer,
            audience:  _jwtAudience,
            claims:    claims,
            expires:   DateTime.UtcNow.AddMinutes(_accessExpiry),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateSecureToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }

    private static string GetExtensionFromContentType(string contentType) => contentType switch
    {
        "image/png" => ".png",
        "image/webp" => ".webp",
        "image/gif" => ".gif",
        _ => ".jpg"
    };

    private static UserDto MapToDto(User u) => new()
    {
        UserId = u.Id.ToString(),
        Name   = u.Name,
        Email  = u.Email,
        Role   = u.Role,
        Avatar = u.AvatarUrl ?? u.AvatarInitials
    };
}
