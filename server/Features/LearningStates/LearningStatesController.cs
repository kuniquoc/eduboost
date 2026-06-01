using System.Security.Claims;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.LearningStates.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.LearningStates;

[ApiController]
[Route("api/learning-states")]
[Authorize]
public class LearningStatesController(ILearningStatesRepository repo) : ControllerBase
{
    private Guid UserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());

    /// <summary>Lấy toàn bộ BKT state của học sinh</summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyStates()
    {
        var states = await repo.GetAllStatesAsync(UserId);
        return Ok(ApiResponse<List<BktStateDto>>.Ok(states));
    }

    /// <summary>Lấy BKT state theo topic</summary>
    [HttpGet("me/topic/{topicId:guid}")]
    public async Task<IActionResult> GetStateByTopic(Guid topicId)
    {
        var state = await repo.GetStateByTopicAsync(UserId, topicId);
        if (state == null) return NotFound(ApiResponse.Fail("Chưa có dữ liệu cho chủ đề này"));
        return Ok(ApiResponse<BktStateDto>.Ok(state));
    }

    /// <summary>Cập nhật BKT sau câu trả lời</summary>
    [HttpPost("update")]
    public async Task<IActionResult> UpdateAfterAnswer([FromBody] UpdateBktRequest request)
    {
        var result = await repo.UpdateAfterAnswerAsync(UserId, request);
        return Ok(ApiResponse<UpdateBktResponse>.Ok(result));
    }

    /// <summary>Lấy danh sách nội dung cần ôn tập hôm nay</summary>
    [HttpGet("me/review-schedule")]
    public async Task<IActionResult> GetReviewSchedule()
    {
        var schedule = await repo.GetReviewScheduleAsync(UserId);
        return Ok(ApiResponse<ReviewScheduleDto>.Ok(schedule));
    }
}
