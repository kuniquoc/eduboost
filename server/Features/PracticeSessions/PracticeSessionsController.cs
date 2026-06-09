using EduBoost.API.Common.Http;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.PracticeSessions.Models;
using EduBoost.API.Features.Quizzes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.PracticeSessions;

[ApiController]
[Route("api/practice-sessions")]
[Authorize]
public class PracticeSessionsController(IPracticeSessionsRepository repo, IQuizAuthorization quizAuth) : ControllerBase
{
    private Guid UserId => ControllerAuth.GetUserId(User);
    private string UserRole => ControllerAuth.GetUserRole(User);

    /// <summary>Student: Bắt đầu phiên luyện tập</summary>
    [HttpPost("start")]
    public async Task<IActionResult> StartSession([FromBody] StartPracticeRequest request)
    {
        if (UserRole != "student") return Forbid();

        var isFixed = string.Equals(request.Mode, "fixed", StringComparison.OrdinalIgnoreCase);
        var isQuizMode = string.Equals(request.Mode, "test", StringComparison.OrdinalIgnoreCase)
            || (string.Equals(request.Mode, "practice", StringComparison.OrdinalIgnoreCase) && request.QuizId.HasValue);

        if (isQuizMode)
        {
            if (!request.QuizId.HasValue || request.QuizId.Value == Guid.Empty)
                return BadRequest(ApiResponse.Fail("QuizId is required for test/practice quiz mode"));
            if (!await quizAuth.CanStudentAccessClassQuizAsync(request.QuizId.Value, UserId))
                return Forbid();
        }
        else if (isFixed)
        {
            if (request.QuestionIds is not { Count: > 0 })
                return BadRequest(ApiResponse.Fail("Fixed mode requires questionIds"));
            if (!await quizAuth.CanStudentAccessFixedQuestionsAsync(request.QuestionIds, UserId))
                return Forbid();
        }
        else
        {
            if (!request.TopicId.HasValue || request.TopicId.Value == Guid.Empty)
                return BadRequest(ApiResponse.Fail("TopicId is required"));
            if (!await quizAuth.CanStudentAccessTopicAsync(request.TopicId.Value, UserId))
                return Forbid();
        }

        try
        {
            var result = await repo.StartSessionAsync(UserId, request);
            return Ok(ApiResponse<StartPracticeResponse>.Ok(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>Student: Bắt đầu phiên ôn tập spaced repetition</summary>
    [HttpPost("start-review")]
    public async Task<IActionResult> StartReviewSession([FromBody] StartReviewRequest request)
    {
        if (UserRole != "student") return Forbid();
        try
        {
            var result = await repo.StartReviewSessionAsync(UserId, request);
            return Ok(ApiResponse<StartPracticeResponse>.Ok(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>Student: Gửi câu trả lời</summary>
    [HttpPost("answer")]
    public async Task<IActionResult> SubmitAnswer([FromBody] SubmitAnswerRequest request)
    {
        if (UserRole != "student") return Forbid();
        try
        {
            var result = await repo.SubmitAnswerAsync(UserId, request);
            return Ok(ApiResponse<SubmitAnswerResponse>.Ok(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>Student: Kết thúc phiên</summary>
    [HttpPost("end")]
    public async Task<IActionResult> EndSession([FromBody] EndPracticeRequest request)
    {
        if (UserRole != "student") return Forbid();
        try
        {
            var result = await repo.EndSessionAsync(UserId, request.SessionId);
            return Ok(ApiResponse<PracticeSessionSummary>.Ok(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }
}
