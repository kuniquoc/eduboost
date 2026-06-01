using System.Security.Claims;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.LearningPaths.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.LearningPaths;

[ApiController]
[Route("api/learning-paths")]
[Authorize]
public class LearningPathsController(ILearningPathsRepository repo) : ControllerBase
{
    private Guid UserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());

    /// <summary>Lấy lộ trình hiện tại</summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyPath()
    {
        var path = await repo.GetMyPathAsync(UserId);
        return Ok(ApiResponse<LearningPathDto>.Ok(path));
    }

    /// <summary>Tái sinh lộ trình (sau phiên học)</summary>
    [HttpPost("regenerate")]
    public async Task<IActionResult> Regenerate()
    {
        var path = await repo.RegenerateAsync(UserId);
        return Ok(ApiResponse<LearningPathDto>.Ok(path, "Đã cập nhật lộ trình học tập"));
    }

    /// <summary>Đánh dấu hoàn thành topic</summary>
    [HttpPut("{id:guid}/complete")]
    public async Task<IActionResult> MarkComplete(Guid id)
    {
        var item = await repo.MarkCompleteAsync(UserId, id);
        if (item == null) return NotFound(ApiResponse.Fail("Không tìm thấy"));
        return Ok(ApiResponse<LearningPathItemDto>.Ok(item, "Đã hoàn thành"));
    }
}
