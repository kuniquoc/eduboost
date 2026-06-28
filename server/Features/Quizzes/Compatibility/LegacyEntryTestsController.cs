using EduBoost.API.Common.Http;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.Classes;
using EduBoost.API.Features.Quizzes.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.Quizzes.Compatibility;

[ApiController]
[Route("api/quizzes")]
[Authorize]
public class LegacyEntryTestsController(IQuizzesRepository repo, IClassesRepository classes) : ControllerBase
{
    private Guid UserId => ControllerAuth.GetUserId(User);
    private string UserRole => ControllerAuth.GetUserRole(User);

    /// <summary>Student: Lấy bài test đầu vào của lớp; dùng placement-tests cho client mới.</summary>
    [Obsolete("Use /api/placement-tests instead")]
    [HttpGet("entry-test/{classId:guid}")]
    public async Task<IActionResult> GetEntryTest(Guid classId)
    {
        if (UserRole != "student") return Forbid();
        if (!await classes.IsStudentEnrolledAsync(classId, UserId)) return Forbid();
        var test = await repo.GetEntryTestAsync(classId);
        if (test == null) return NotFound(ApiResponse.Fail("Lớp học chưa có bài test đầu vào"));
        return Ok(ApiResponse<EntryTestDto>.Ok(test));
    }

    /// <summary>Student: Nộp bài test đầu vào; dùng placement-tests cho client mới.</summary>
    [Obsolete("Use /api/placement-tests instead")]
    [HttpPost("entry-test/{classId:guid}/submit")]
    public async Task<IActionResult> SubmitEntryTest(Guid classId, [FromBody] SubmitQuizRequest request)
    {
        if (UserRole != "student") return Forbid();
        if (!await classes.IsStudentEnrolledAsync(classId, UserId)) return Forbid();
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var result = await repo.SubmitEntryTestAsync(classId, UserId, request);
        return Ok(ApiResponse<QuizResultDto>.Ok(result, "Nộp bài thành công. AI đang tạo lộ trình học tập..."));
    }
}
