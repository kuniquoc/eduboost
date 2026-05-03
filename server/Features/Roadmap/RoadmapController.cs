using System.Security.Claims;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.Roadmap.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.Roadmap;

[ApiController]
[Route("api/roadmap")]
[Authorize]
public class RoadmapController(IRoadmapRepository repo) : ControllerBase
{
    private Guid UserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());

    /// <summary>Student: Lấy lộ trình học tập trong lớp</summary>
    [HttpGet("{classId:guid}")]
    public async Task<IActionResult> GetRoadmap(Guid classId)
    {
        var roadmap = await repo.GetByClassIdAsync(classId, UserId);
        if (roadmap == null) return NotFound(ApiResponse.Fail("Chưa có lộ trình. Hãy hoàn thành bài test đầu vào trước."));
        return Ok(ApiResponse<RoadmapDto>.Ok(roadmap));
    }

    /// <summary>Student: AI tạo lộ trình sau khi nộp bài test đầu vào</summary>
    [HttpPost("{classId:guid}/generate")]
    public async Task<IActionResult> GenerateRoadmap(Guid classId, [FromBody] GenerateRoadmapRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var roadmap = await repo.GenerateAsync(classId, UserId, request.EntryTestResultId);
        return Ok(ApiResponse<RoadmapDto>.Ok(roadmap, "AI đã tạo lộ trình học tập cá nhân hoá cho bạn!"));
    }

    /// <summary>Student: Cập nhật tiến độ một bước trong lộ trình</summary>
    [HttpPatch("{classId:guid}/steps/{stepId}")]
    public async Task<IActionResult> UpdateStep(Guid classId, string stepId, [FromBody] UpdateStepRequest request)
    {
        var step = await repo.UpdateStepAsync(classId, stepId, request);
        if (step == null) return NotFound(ApiResponse.Fail("Không tìm thấy bước trong lộ trình"));
        return Ok(ApiResponse<RoadmapStepDto>.Ok(step, "Cập nhật tiến độ thành công"));
    }
}
