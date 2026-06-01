using System.Security.Claims;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.PracticeSessions.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.PracticeSessions;

[ApiController]
[Route("api/practice-sessions")]
[Authorize]
public class PracticeSessionsController(IPracticeSessionsRepository repo) : ControllerBase
{
    private Guid UserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());

    /// <summary>Bắt đầu phiên luyện tập</summary>
    [HttpPost("start")]
    public async Task<IActionResult> StartSession([FromBody] StartPracticeRequest request)
    {
        var result = await repo.StartSessionAsync(UserId, request);
        return Ok(ApiResponse<StartPracticeResponse>.Ok(result));
    }

    /// <summary>Gửi câu trả lời → cập nhật BKT + SR → trả phản hồi + câu tiếp</summary>
    [HttpPost("answer")]
    public async Task<IActionResult> SubmitAnswer([FromBody] SubmitAnswerRequest request)
    {
        var result = await repo.SubmitAnswerAsync(UserId, request);
        return Ok(ApiResponse<SubmitAnswerResponse>.Ok(result));
    }

    /// <summary>Kết thúc phiên → cập nhật LearningSession + tiến trình</summary>
    [HttpPost("end")]
    public async Task<IActionResult> EndSession([FromBody] EndPracticeRequest request)
    {
        var result = await repo.EndSessionAsync(UserId, request.SessionId);
        return Ok(ApiResponse<PracticeSessionSummary>.Ok(result));
    }
}
