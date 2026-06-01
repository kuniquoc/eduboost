using System.Security.Claims;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.UserProfiles.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.UserProfiles;

[ApiController]
[Route("api/user-profiles")]
[Authorize]
public class UserProfilesController(IUserProfilesRepository repo) : ControllerBase
{
    private Guid UserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());

    /// <summary>Lấy profile người dùng hiện tại</summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyProfile()
    {
        var profile = await repo.GetProfileAsync(UserId);
        return Ok(ApiResponse<UserProfileDto>.Ok(profile));
    }

    /// <summary>Cập nhật profile (preferences)</summary>
    [HttpPut("me")]
    public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateProfileRequest request)
    {
        var profile = await repo.UpdateProfileAsync(UserId, request);
        return Ok(ApiResponse<UserProfileDto>.Ok(profile, "Cập nhật thành công"));
    }

    /// <summary>Admin/GV xem profile học sinh</summary>
    [HttpGet("{userId:guid}")]
    public async Task<IActionResult> GetUserProfile(Guid userId)
    {
        var profile = await repo.GetProfileByUserIdAsync(userId, UserId);
        if (profile == null) return NotFound(ApiResponse.Fail("Không tìm thấy profile"));
        return Ok(ApiResponse<UserProfileDto>.Ok(profile));
    }
}
