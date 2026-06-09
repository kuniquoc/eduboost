using EduBoost.API.Common.Http;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.LearningStates.Models;
using EduBoost.API.Features.Quizzes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.LearningStates;

[ApiController]
[Route("api/learning-states")]
[Authorize]
public class LearningStatesController(ILearningStatesRepository repo, IQuizAuthorization quizAuth) : ControllerBase
{
    private Guid UserId => ControllerAuth.GetUserId(User);
    private string UserRole => ControllerAuth.GetUserRole(User);

    /// <summary>Student: Lấy toàn bộ BKT state</summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyStates()
    {
        if (UserRole != "student") return Forbid();
        var states = await repo.GetAllStatesAsync(UserId);
        return Ok(ApiResponse<List<BktStateDto>>.Ok(states));
    }

    /// <summary>Student: Lấy BKT state theo topic</summary>
    [HttpGet("me/topic/{topicId:guid}")]
    public async Task<IActionResult> GetStateByTopic(Guid topicId)
    {
        if (UserRole != "student") return Forbid();
        if (!await quizAuth.CanStudentAccessTopicAsync(topicId, UserId)) return Forbid();
        var state = await repo.GetStateByTopicAsync(UserId, topicId);
        if (state == null) return NotFound(ApiResponse.Fail("Chưa có dữ liệu cho chủ đề này"));
        return Ok(ApiResponse<BktStateDto>.Ok(state));
    }

    /// <summary>Student: Cập nhật BKT sau câu trả lời</summary>
    [HttpPost("update")]
    public async Task<IActionResult> UpdateAfterAnswer([FromBody] UpdateBktRequest request)
    {
        if (UserRole != "student") return Forbid();
        if (!await quizAuth.CanStudentAccessTopicAsync(request.TopicId, UserId)) return Forbid();
        var result = await repo.UpdateAfterAnswerAsync(UserId, request);
        return Ok(ApiResponse<UpdateBktResponse>.Ok(result));
    }

    /// <summary>Student: Lấy danh sách nội dung cần ôn tập hôm nay</summary>
    [HttpGet("me/review-schedule")]
    public async Task<IActionResult> GetReviewSchedule()
    {
        if (UserRole != "student") return Forbid();
        var schedule = await repo.GetReviewScheduleAsync(UserId);
        return Ok(ApiResponse<ReviewScheduleDto>.Ok(schedule));
    }
}
