using EduBoost.API.Common.Http;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.Classes;
using EduBoost.API.Features.Students.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.Students;

[ApiController]
[Authorize]
[Route("api")]
public class StudentsController(IStudentsRepository repo, IClassesRepository classes) : ControllerBase
{
    private Guid UserId => ControllerAuth.GetUserId(User);
    private string UserRole => ControllerAuth.GetUserRole(User);

    /// <summary>Teacher: Thống kê tổng quan toàn lớp</summary>
    [HttpGet("classes/{classId:guid}/analytics")]
    public async Task<IActionResult> GetClassAnalytics(Guid classId)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        var analytics = await repo.GetClassAnalyticsAsync(classId);
        return Ok(ApiResponse<ClassAnalyticsDto>.Ok(analytics));
    }

    /// <summary>Teacher: Chi tiết analytics của một học sinh trong lớp</summary>
    [HttpGet("classes/{classId:guid}/students/{studentId:guid}/analytics")]
    public async Task<IActionResult> GetStudentAnalytics(Guid classId, Guid studentId)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        var analytics = await repo.GetStudentAnalyticsAsync(classId, studentId);
        if (analytics == null) return NotFound(ApiResponse.Fail("Không tìm thấy học sinh"));
        return Ok(ApiResponse<StudentAnalyticsDto>.Ok(analytics));
    }

    /// <summary>Student: Tiến độ học tập của bản thân</summary>
    [HttpGet("students/me/progress")]
    public async Task<IActionResult> GetMyProgress()
    {
        if (UserRole != "student") return Forbid();
        var progress = await repo.GetMyProgressAsync(UserId);
        return Ok(ApiResponse<StudentProgressDto>.Ok(progress));
    }

    /// <summary>Student: Thống kê cá nhân (streak, avg score...)</summary>
    [HttpGet("students/me/stats")]
    public async Task<IActionResult> GetMyStats()
    {
        if (UserRole != "student") return Forbid();
        var stats = await repo.GetMyStatsAsync(UserId);
        return Ok(ApiResponse<StudentStatsDto>.Ok(stats));
    }
}
