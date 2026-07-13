using EduBoost.API.Common.Http;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.Admin;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "admin")]
public class AdminController(IAdminRepository repo) : ControllerBase
{
    /// <summary>Danh sách tài khoản</summary>
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery] string? search, [FromQuery] string? role)
    {
        var users = await repo.GetUsersAsync(search, role);
        return Ok(ApiResponse<List<AdminUserDto>>.Ok(users));
    }

    /// <summary>Thay đổi role</summary>
    [HttpPut("users/{id:guid}/role")]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateRoleRequest request)
    {
        var success = await repo.UpdateRoleAsync(id, request.Role);
        if (!success) return BadRequest(ApiResponse.Fail("Không thể cập nhật role"));
        return Ok(ApiResponse.Ok("Đã cập nhật role"));
    }

    /// <summary>Xóa vĩnh viễn tài khoản và dữ liệu liên quan</summary>
    [HttpDelete("users/{id:guid}")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        var result = await repo.DeleteUserAsync(id, ControllerAuth.GetUserId(User));
        return result switch
        {
            DeleteUserResult.Deleted => Ok(ApiResponse.Ok("Đã xóa vĩnh viễn tài khoản và dữ liệu liên quan")),
            DeleteUserResult.NotFound => NotFound(ApiResponse.Fail("Không tìm thấy user")),
            DeleteUserResult.SelfDeletionForbidden => Conflict(ApiResponse.Fail("Không thể tự xóa tài khoản admin đang đăng nhập")),
            DeleteUserResult.LastAdminForbidden => Conflict(ApiResponse.Fail("Không thể xóa admin cuối cùng của hệ thống")),
            _ => throw new ArgumentOutOfRangeException(nameof(result), result, null)
        };
    }

    /// <summary>Thống kê hệ thống</summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var stats = await repo.GetStatsAsync();
        return Ok(ApiResponse<SystemStatsDto>.Ok(stats));
    }
}
