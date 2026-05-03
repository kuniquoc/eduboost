using System.Security.Claims;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.Quizzes.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.Quizzes;

[ApiController]
[Route("api/quizzes")]
[Authorize]
public class QuizzesController(IQuizzesRepository repo) : ControllerBase
{
    private Guid UserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());

    /// <summary>Teacher: Lấy câu hỏi của quiz để kiểm duyệt</summary>
    [HttpGet("{quizId:guid}/questions")]
    public async Task<IActionResult> GetQuestions(Guid quizId)
    {
        var questions = await repo.GetQuestionsAsync(quizId);
        return Ok(ApiResponse<List<QuestionDto>>.Ok(questions));
    }

    /// <summary>Teacher: Chỉnh sửa câu hỏi</summary>
    [HttpPut("{quizId:guid}/questions/{qId:guid}")]
    public async Task<IActionResult> UpdateQuestion(Guid quizId, Guid qId, [FromBody] UpdateQuestionRequest request)
    {
        var q = await repo.UpdateQuestionAsync(qId, request);
        if (q == null) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        return Ok(ApiResponse<QuestionDto>.Ok(q, "Cập nhật câu hỏi thành công"));
    }

    /// <summary>Teacher: Xoá câu hỏi</summary>
    [HttpDelete("{quizId:guid}/questions/{qId:guid}")]
    public async Task<IActionResult> DeleteQuestion(Guid quizId, Guid qId)
    {
        var ok = await repo.DeleteQuestionAsync(qId);
        if (!ok) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        return Ok(ApiResponse.Ok("Xoá câu hỏi thành công"));
    }

    /// <summary>Teacher: Đánh dấu câu hỏi đã/chưa được kiểm duyệt</summary>
    [HttpPatch("{quizId:guid}/questions/{qId:guid}/verify")]
    public async Task<IActionResult> VerifyQuestion(Guid quizId, Guid qId, [FromBody] VerifyQuestionRequest request)
    {
        var q = await repo.VerifyQuestionAsync(qId, request.Verified);
        if (q == null) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        return Ok(ApiResponse<QuestionDto>.Ok(q, request.Verified ? "Đã xác nhận câu hỏi" : "Đã bỏ xác nhận"));
    }

    /// <summary>Teacher: Publish quiz lên lớp học</summary>
    [HttpPost("{quizId:guid}/publish")]
    public async Task<IActionResult> PublishQuiz(Guid quizId)
    {
        var ok = await repo.PublishQuizAsync(quizId);
        if (!ok) return NotFound(ApiResponse.Fail("Không tìm thấy quiz"));
        return Ok(ApiResponse.Ok("Đã publish quiz. Học sinh có thể bắt đầu làm bài."));
    }

    /// <summary>Student: Lấy bài test đầu vào của lớp</summary>
    [HttpGet("entry-test/{classId:guid}")]
    public async Task<IActionResult> GetEntryTest(Guid classId)
    {
        var test = await repo.GetEntryTestAsync(classId);
        if (test == null) return NotFound(ApiResponse.Fail("Lớp học chưa có bài test đầu vào"));
        return Ok(ApiResponse<EntryTestDto>.Ok(test));
    }

    /// <summary>Student: Nộp bài test đầu vào</summary>
    [HttpPost("entry-test/{classId:guid}/submit")]
    public async Task<IActionResult> SubmitEntryTest(Guid classId, [FromBody] SubmitQuizRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var result = await repo.SubmitEntryTestAsync(classId, UserId, request);
        return Ok(ApiResponse<QuizResultDto>.Ok(result, "Nộp bài thành công. AI đang tạo lộ trình học tập..."));
    }

    /// <summary>Student: Lấy câu hỏi luyện tập theo topic</summary>
    [HttpGet("practice/{topicId:guid}")]
    public async Task<IActionResult> GetPracticeQuiz(Guid topicId, [FromQuery] int limit = 10)
    {
        var quiz = await repo.GetPracticeQuizAsync(topicId, limit);
        return Ok(ApiResponse<EntryTestDto>.Ok(quiz));
    }

    /// <summary>Student: Nộp bài luyện tập</summary>
    [HttpPost("practice/{topicId:guid}/submit")]
    public async Task<IActionResult> SubmitPracticeQuiz(Guid topicId, [FromBody] SubmitQuizRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var result = await repo.SubmitPracticeQuizAsync(topicId, UserId, request);
        return Ok(ApiResponse<QuizResultDto>.Ok(result, "Hoàn thành luyện tập!"));
    }

    /// <summary>Student: Lấy câu hỏi quiz riêng của mình</summary>
    [HttpGet("my/{quizId:guid}/questions")]
    public async Task<IActionResult> GetMyQuizQuestions(Guid quizId)
    {
        var questions = await repo.GetMyQuizQuestionsAsync(quizId);
        return Ok(ApiResponse<List<QuestionDto>>.Ok(questions));
    }

    /// <summary>Student: Chỉnh sửa câu hỏi trong quiz riêng của mình</summary>
    [HttpPut("my/{quizId:guid}/questions/{qId:guid}")]
    public async Task<IActionResult> UpdateMyQuestion(Guid quizId, Guid qId, [FromBody] UpdateQuestionRequest request)
    {
        var q = await repo.UpdateMyQuestionAsync(qId, request);
        if (q == null) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        return Ok(ApiResponse<QuestionDto>.Ok(q, "Cập nhật thành công"));
    }
}
