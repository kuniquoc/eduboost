using System.ComponentModel.DataAnnotations;

namespace EduBoost.API.Features.Auth.Models;

public class LoginRequest
{
    [Required] public string Email { get; set; } = "";
    [Required] public string Password { get; set; } = "";
}

public class RegisterRequest
{
    [Required] public string Name { get; set; } = "";
    [Required, EmailAddress] public string Email { get; set; } = "";
    [Required, MinLength(6)] public string Password { get; set; } = "";
    [Required] public string Role { get; set; } = "student"; // "teacher" | "student"
}

public class RefreshTokenRequest
{
    [Required] public string RefreshToken { get; set; } = "";
}

public class RevokeTokenRequest
{
    [Required] public string RefreshToken { get; set; } = "";
}

public class UpdateNameRequest
{
    [Required, MinLength(1)] public string Name { get; set; } = "";
}

public class UserDto
{
    public string UserId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Role { get; set; } = "";
    public string? Avatar { get; set; }
}

/// <summary>Trả về cả Access Token và Refresh Token sau login/register/refresh.</summary>
public class AuthTokensDto
{
    public string AccessToken { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public UserDto User { get; set; } = new();
}

// Keep for backward compat if needed
public class LoginResponse
{
    public string Token { get; set; } = "";
    public UserDto User { get; set; } = new();
}
