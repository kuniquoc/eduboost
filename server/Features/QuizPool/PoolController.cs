using System.Security.Claims;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.Quizzes.Models;
using EduBoost.API.Features.QuizPool.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.QuizPool;

[ApiController]
[Route("api/pool")]
[Authorize]
public class PoolController(IPoolRepository repo) : ControllerBase
{
    private Guid UserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());

    private string UserRole => User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "student";

    /// <summary>AI tự động sinh quiz lưu vào Quiz Pool của Giáo viên hoặc Học sinh theo Chủ đề</summary>
    [HttpPost("generate")]
    public async Task<IActionResult> GeneratePoolQuiz([FromBody] GeneratePoolQuizRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));

        var quiz = await repo.GeneratePoolQuizAsync(UserId, UserRole, request);
        if (quiz == null)
        {
            return StatusCode(500, ApiResponse.Fail("AI Agent không thể tạo câu hỏi cho chủ đề này. Vui lòng thử lại sau."));
        }

        return Ok(ApiResponse<QuizDto>.Ok(quiz, "Sinh câu hỏi AI vào Quiz Pool thành công. Nội dung đã được cộng dồn!"));
    }

    /// <summary>Tìm kiếm danh sách chủ đề (Topic) có câu hỏi ôn tập trong Pool</summary>
    [HttpGet("topics")]
    public async Task<IActionResult> GetTopicsInPool([FromQuery] string? search, [FromQuery] Guid? classId)
    {
        var topics = await repo.GetTopicsInPoolAsync(UserId, UserRole, search, classId);
        return Ok(ApiResponse<List<TopicPoolDto>>.Ok(topics));
    }

    /// <summary>Lấy danh sách các câu hỏi ôn tập chi tiết của một Chủ đề để Preview trước khi chọn</summary>
    [HttpGet("topics/{topicId:guid}/quizzes")]
    public async Task<IActionResult> GetQuizzesInTopicPool(Guid topicId)
    {
        var quizzes = await repo.GetQuizzesInTopicPoolAsync(UserId, topicId);
        return Ok(ApiResponse<List<PoolQuizDetailDto>>.Ok(quizzes));
    }

    /// <summary>Xóa một lượt sinh quiz ôn tập trong Pool</summary>
    [HttpDelete("quizzes/{quizId:guid}")]
    public async Task<IActionResult> DeletePoolQuiz(Guid quizId)
    {
        var ok = await repo.DeletePoolQuizAsync(UserId, quizId);
        if (!ok) return NotFound(ApiResponse.Fail("Không tìm thấy quiz trong pool hoặc bạn không có quyền xóa"));
        return Ok(ApiResponse.Ok("Xóa quiz khỏi Pool thành công"));
    }

    /// <summary>Teacher: Tổng hợp câu hỏi trong Pool để tạo bài Test lớp học</summary>
    [HttpPost("create-test")]
    public async Task<IActionResult> CreateTestFromPool([FromBody] CreateTestFromPoolRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        if (UserRole != "teacher") return Forbid();
        if (request.PoolQuizIds.Count == 0) return BadRequest(ApiResponse.Fail("Cần chọn ít nhất một quiz trong pool để tạo bài test"));

        var test = await repo.CreateTestFromPoolAsync(UserId, request);
        return Ok(ApiResponse<QuizDto>.Ok(test, "Tổng hợp bài thi từ Pool thành công. Hãy kiểm duyệt và xuất bản trong AI Studio!"));
    }

    /// <summary>Student: Tổng hợp câu hỏi trong Pool để tạo bộ Ôn tập cá nhân</summary>
    [HttpPost("create-revision-set")]
    public async Task<IActionResult> CreateRevisionSetFromPool([FromBody] CreateRevisionSetFromPoolRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        if (request.PoolQuizIds.Count == 0) return BadRequest(ApiResponse.Fail("Cần chọn ít nhất một quiz trong pool để tạo bộ ôn tập"));

        var revisionSet = await repo.CreateRevisionSetFromPoolAsync(UserId, request);
        return Ok(ApiResponse<QuizDto>.Ok(revisionSet, "Tạo bộ ôn tập cá nhân thành công. Bạn có thể bắt đầu ôn luyện!"));
    }

    /// <summary>Student: Lấy danh sách bộ ôn tập cá nhân</summary>
    [HttpGet("revision-sets")]
    public async Task<IActionResult> GetRevisionSets()
    {
        var sets = await repo.GetRevisionSetsAsync(UserId);
        return Ok(ApiResponse<List<QuizDto>>.Ok(sets));
    }
}
