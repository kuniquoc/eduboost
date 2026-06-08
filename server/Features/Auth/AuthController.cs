using System.Security.Claims;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.Auth.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.Auth;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthRepository repo) : ControllerBase
{
    /// <summary>Đăng nhập — trả về Access Token + Refresh Token</summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        try
        {
            var result = await repo.LoginAsync(request.Email, request.Password);
            return Ok(ApiResponse<AuthTokensDto>.Ok(result, "Đăng nhập thành công"));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>Đăng ký tài khoản mới</summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        try
        {
            var result = await repo.RegisterAsync(request);
            return Ok(ApiResponse<AuthTokensDto>.Ok(result, "Đăng ký thành công"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>Làm mới Access Token bằng Refresh Token (token rotation)</summary>
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var result = await repo.RefreshTokenAsync(request.RefreshToken);
        if (result == null) return Unauthorized(ApiResponse.Fail("Refresh token không hợp lệ hoặc đã hết hạn"));
        return Ok(ApiResponse<AuthTokensDto>.Ok(result, "Làm mới token thành công"));
    }

    /// <summary>Thu hồi Refresh Token (logout)</summary>
    [HttpPost("revoke")]
    [Authorize]
    public async Task<IActionResult> Revoke([FromBody] RevokeTokenRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var success = await repo.RevokeTokenAsync(request.RefreshToken);
        if (!success) return BadRequest(ApiResponse.Fail("Token không hợp lệ hoặc đã bị thu hồi"));
        return Ok(ApiResponse.Ok("Đăng xuất thành công"));
    }

    /// <summary>Upload ảnh đại diện</summary>
    [HttpPost("me/avatar")]
    [Authorize]
    [RequestSizeLimit(2_000_000)]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse.Fail("File không hợp lệ"));

        if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse.Fail("Chỉ chấp nhận file ảnh"));

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(ApiResponse.Fail("Token không hợp lệ"));

        await using var stream = file.OpenReadStream();
        var user = await repo.UpdateAvatarAsync(userId, stream, file.ContentType);
        if (user == null) return NotFound(ApiResponse.Fail("Không tìm thấy user"));
        return Ok(ApiResponse<UserDto>.Ok(user, "Cập nhật ảnh đại diện thành công"));
    }

    /// <summary>Cập nhật tên hiển thị</summary>
    [HttpPatch("me/name")]
    [Authorize]
    public async Task<IActionResult> UpdateName([FromBody] UpdateNameRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(ApiResponse.Fail("Token không hợp lệ"));

        var user = await repo.UpdateNameAsync(userId, request.Name);
        if (user == null) return NotFound(ApiResponse.Fail("Không tìm thấy user"));
        return Ok(ApiResponse<UserDto>.Ok(user, "Cập nhật tên thành công"));
    }

    /// <summary>Lấy thông tin user đang đăng nhập</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetMe()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(ApiResponse.Fail("Token không hợp lệ"));

        var user = await repo.GetByIdAsync(userId);
        if (user == null) return NotFound(ApiResponse.Fail("Không tìm thấy user"));
        return Ok(ApiResponse<UserDto>.Ok(user));
    }
}
