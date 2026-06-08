using System.Security.Claims;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.PlacementTests.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.PlacementTests;

[ApiController]
[Route("api/placement-tests")]
[Authorize]
public class PlacementTestsController(IPlacementTestsRepository repo) : ControllerBase
{
    private Guid UserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());

    /// <summary>Bắt đầu bài kiểm tra đầu vào thích ứng (theo lớp nếu có classId)</summary>
    [HttpPost("start")]
    public async Task<IActionResult> StartTest([FromBody] StartPlacementTestRequest? request)
    {
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

    /// <summary>Gửi câu trả lời, nhận câu tiếp theo (adaptive difficulty)</summary>
    [HttpPost("answer")]
    public async Task<IActionResult> SubmitAnswer([FromBody] AnswerPlacementRequest request)
    {
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

    /// <summary>Kết thúc → tính toán level → khởi tạo BKT + roadmap</summary>
    [HttpPost("complete")]
    public async Task<IActionResult> CompleteTest([FromBody] CompletePlacementRequest request)
    {
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

    /// <summary>Xem kết quả kiểm tra đầu vào (mới nhất, có thể lọc theo lớp)</summary>
    [HttpGet("result")]
    public async Task<IActionResult> GetResult([FromQuery] Guid? classId)
    {
        var result = await repo.GetResultAsync(UserId, classId);
        if (result == null) return NotFound(ApiResponse.Fail("Chưa có kết quả kiểm tra đầu vào"));
        return Ok(ApiResponse<PlacementTestResultDto>.Ok(result));
    }
}

public class CompletePlacementRequest
{
    public string SessionId { get; set; } = "";
}
