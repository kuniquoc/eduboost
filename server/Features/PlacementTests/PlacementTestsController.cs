using EduBoost.API.Common.Http;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.PlacementTests.Models;
using EduBoost.API.Features.PracticeSessions.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.PlacementTests;

[ApiController]
[Route("api/placement-tests")]
[Authorize]
public class PlacementTestsController(IPlacementTestsRepository repo) : ControllerBase
{
    private Guid UserId => ControllerAuth.GetUserId(User);
    private string UserRole => ControllerAuth.GetUserRole(User);

    /// <summary>Student: Bắt đầu bài kiểm tra đầu vào thích ứng</summary>
    [HttpPost("start")]
    public async Task<IActionResult> StartTest([FromBody] StartPlacementTestRequest? request)
    {
        if (UserRole != "student") return Forbid();
        try
        {
            Guid? classId = Guid.TryParse(request?.ClassId, out var parsed) ? parsed : null;
            var result = await repo.StartTestAsync(UserId, classId);
            return Ok(ApiResponse<StartPlacementTestResponse>.Ok(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>Student: Gửi câu trả lời adaptive</summary>
    [HttpPost("answer")]
    public async Task<IActionResult> SubmitAnswer([FromBody] AnswerPlacementRequest request)
    {
        if (UserRole != "student") return Forbid();
        try
        {
            var result = await repo.SubmitAnswerAsync(UserId, request);
            return Ok(ApiResponse<AnswerPlacementResponse>.Ok(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>Student: Kết thúc → level + BKT + roadmap</summary>
    [HttpPost("complete")]
    public async Task<IActionResult> CompleteTest([FromBody] CompletePlacementRequest request)
    {
        if (UserRole != "student") return Forbid();
        try
        {
            var result = await repo.CompleteTestAsync(UserId, request.SessionId);
            return Ok(ApiResponse<CompletePlacementResponse>.Ok(result, "Đã xác định trình độ và khởi tạo lộ trình!"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>Student: Xem kết quả kiểm tra đầu vào</summary>
    [HttpGet("result")]
    public async Task<IActionResult> GetResult([FromQuery] Guid? classId)
    {
        if (UserRole != "student") return Forbid();
        var result = await repo.GetResultAsync(UserId, classId);
        if (result == null) return NotFound(ApiResponse.Fail("Chưa có kết quả kiểm tra đầu vào"));
        return Ok(ApiResponse<PlacementTestResultDto>.Ok(result));
    }

    /// <summary>Student: Xem lại chi tiết từng câu sau khi hoàn thành</summary>
    [HttpGet("result/{resultId:guid}/review")]
    public async Task<IActionResult> GetReview(Guid resultId)
    {
        if (UserRole != "student") return Forbid();
        var review = await repo.GetReviewAsync(UserId, resultId);
        if (review == null) return NotFound(ApiResponse.Fail("Không tìm thấy kết quả kiểm tra"));
        return Ok(ApiResponse<List<QuizReviewItemDto>>.Ok(review));
    }
}

public class CompletePlacementRequest
{
    public string SessionId { get; set; } = "";
}
