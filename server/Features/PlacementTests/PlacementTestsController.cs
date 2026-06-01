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

    /// <summary>Bắt đầu bài kiểm tra đầu vào (adaptive)</summary>
    [HttpPost("start")]
    public async Task<IActionResult> StartTest()
    {
        var result = await repo.StartTestAsync(UserId);
        return Ok(ApiResponse<StartPlacementTestResponse>.Ok(result));
    }

    /// <summary>Gửi câu trả lời, nhận câu tiếp theo (adaptive difficulty)</summary>
    [HttpPost("answer")]
    public async Task<IActionResult> SubmitAnswer([FromBody] AnswerPlacementRequest request)
    {
        var result = await repo.SubmitAnswerAsync(UserId, request);
        return Ok(ApiResponse<AnswerPlacementResponse>.Ok(result));
    }

    /// <summary>Kết thúc → tính toán level → khởi tạo BKT + learning path</summary>
    [HttpPost("complete")]
    public async Task<IActionResult> CompleteTest([FromBody] CompletePlacementRequest request)
    {
        var result = await repo.CompleteTestAsync(UserId, request.SessionId);
        return Ok(ApiResponse<CompletePlacementResponse>.Ok(result, "Đã xác định trình độ và khởi tạo lộ trình!"));
    }

    /// <summary>Xem kết quả kiểm tra đầu vào</summary>
    [HttpGet("result")]
    public async Task<IActionResult> GetResult()
    {
        var result = await repo.GetResultAsync(UserId);
        if (result == null) return NotFound(ApiResponse.Fail("Chưa có kết quả kiểm tra đầu vào"));
        return Ok(ApiResponse<PlacementTestResultDto>.Ok(result));
    }
}

public class CompletePlacementRequest
{
    public string SessionId { get; set; } = "";
}
