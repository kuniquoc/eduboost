using System.Security.Claims;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.Students.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.Students;

[ApiController]
[Authorize]
public class StudentsController(IStudentsRepository repo) : ControllerBase
{
    private Guid UserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());

    /// <summary>Teacher: Thống kê tổng quan toàn lớp</summary>
    [HttpGet("api/classes/{classId:guid}/analytics")]
    public async Task<IActionResult> GetClassAnalytics(Guid classId)
    {
        var analytics = await repo.GetClassAnalyticsAsync(classId);
        return Ok(ApiResponse<ClassAnalyticsDto>.Ok(analytics));
    }

    /// <summary>Teacher: Chi tiết analytics của một học sinh trong lớp</summary>
    [HttpGet("api/classes/{classId:guid}/students/{studentId:guid}/analytics")]
    public async Task<IActionResult> GetStudentAnalytics(Guid classId, Guid studentId)
    {
        var analytics = await repo.GetStudentAnalyticsAsync(classId, studentId);
        if (analytics == null) return NotFound(ApiResponse.Fail("Không tìm thấy học sinh"));
        return Ok(ApiResponse<StudentAnalyticsDto>.Ok(analytics));
    }

    /// <summary>Student: Tiến độ học tập của bản thân</summary>
    [HttpGet("api/students/me/progress")]
    public async Task<IActionResult> GetMyProgress()
    {
        var progress = await repo.GetMyProgressAsync(UserId);
        return Ok(ApiResponse<StudentProgressDto>.Ok(progress));
    }

    /// <summary>Student: Thống kê cá nhân (streak, avg score...)</summary>
    [HttpGet("api/students/me/stats")]
    public async Task<IActionResult> GetMyStats()
    {
        var stats = await repo.GetMyStatsAsync(UserId);
        return Ok(ApiResponse<StudentStatsDto>.Ok(stats));
    }
}
