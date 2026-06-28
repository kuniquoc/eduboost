using EduBoost.API.Common.Models;
using EduBoost.API.Features.Quizzes.Models;
using EduBoost.API.Features.QuizPool.Models;
using EduBoost.API.Features.Topics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using EduBoost.API.Common.Http;
using EduBoost.API.Features.Classes;
using EduBoost.API.Features.Quizzes;

namespace EduBoost.API.Features.QuizPool;

[ApiController]
[Route("api/pool")]
[Authorize]
public class PoolController(
    IPoolRepository repo,
    IPoolAuthorization poolAuth,
    IClassesRepository classes,
    ITopicsRepository topics,
    IQuizzesRepository quizzes) : ControllerBase
{
    private Guid UserId => ControllerAuth.GetUserId(User);
    private string UserRole => ControllerAuth.GetUserRole(User);

    /// <summary>AI tự động sinh quiz lưu vào Quiz Pool của Giáo viên hoặc Học sinh theo Chủ đề</summary>
    [HttpPost("generate")]
    public async Task<IActionResult> GeneratePoolQuiz([FromBody] GeneratePoolQuizRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));

        if (string.IsNullOrWhiteSpace(request.TopicId) && string.IsNullOrWhiteSpace(request.TopicName))
            return BadRequest(ApiResponse.Fail("Cần cung cấp tên chủ đề hoặc topicId"));

        if (string.IsNullOrWhiteSpace(request.DocumentId) && string.IsNullOrWhiteSpace(request.UserSuggestion))
            return BadRequest(ApiResponse.Fail("Cần cung cấp ít nhất một nguồn để sinh quiz: gợi ý nội dung hoặc tài liệu"));

        if (!string.IsNullOrEmpty(request.TopicId))
        {
            var topicId = Guid.Parse(request.TopicId);
            if (!await poolAuth.CanAccessTopicAsync(UserId, UserRole, topicId)) return Forbid();

            if (!string.IsNullOrEmpty(request.ClassId))
            {
                var classId = Guid.Parse(request.ClassId);
                if (!await topics.BelongsToClassAsync(topicId, classId)) return Forbid();
            }
        }

        if (UserRole == "teacher" && !string.IsNullOrEmpty(request.ClassId))
        {
            var classId = Guid.Parse(request.ClassId);
            if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        }

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
        if (classId.HasValue && UserRole == "teacher" && !await classes.IsOwnedByTeacherAsync(classId.Value, UserId))
            return Forbid();

        var topics = await repo.GetTopicsInPoolAsync(UserId, UserRole, search, classId);
        return Ok(ApiResponse<List<TopicPoolDto>>.Ok(topics));
    }

    /// <summary>Lấy danh sách các câu hỏi ôn tập chi tiết của một Chủ đề để Preview trước khi chọn</summary>
    [HttpGet("topics/{topicId:guid}/quizzes")]
    public async Task<IActionResult> GetQuizzesInTopicPool(Guid topicId)
    {
        if (!await poolAuth.CanAccessTopicAsync(UserId, UserRole, topicId)) return Forbid();
        var quizzes = await repo.GetQuizzesInTopicPoolAsync(UserId, topicId);
        return Ok(ApiResponse<List<PoolQuizDetailDto>>.Ok(quizzes));
    }

    /// <summary>Xóa một lượt sinh quiz ôn tập trong Pool</summary>
    [HttpDelete("quizzes/{quizId:guid}")]
    public async Task<IActionResult> DeletePoolQuiz(Guid quizId)
    {
        var result = await repo.DeletePoolQuizAsync(UserId, quizId);
        return result switch
        {
            DeletePoolQuizResult.NotFound => NotFound(ApiResponse.Fail("Không tìm thấy quiz này trong Pool")),
            DeletePoolQuizResult.Forbidden => StatusCode(403, ApiResponse.Fail("Bạn không có quyền xóa quiz này — quiz thuộc về người dùng khác")),
            _ => Ok(ApiResponse.Ok("Xóa quiz khỏi Pool thành công"))
        };
    }

    /// <summary>Teacher: Tổng hợp câu hỏi trong Pool để tạo bài Test lớp học</summary>
    [HttpPost("create-test")]
    public async Task<IActionResult> CreateTestFromPool([FromBody] CreateTestFromPoolRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        if (UserRole != "teacher") return Forbid();

        if (request.QuestionIds.Count == 0 && request.PoolQuizIds.Count == 0)
            return BadRequest(ApiResponse.Fail("Cần chọn ít nhất một câu hỏi hoặc quiz trong pool để tạo bài test"));

        var classId = Guid.Parse(request.ClassId);
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();

        var poolQuizIds = request.PoolQuizIds.Select(Guid.Parse).ToList();
        if (request.QuestionIds.Count > 0)
        {
            var questionGuids = request.QuestionIds.Select(Guid.Parse).ToList();
            var parentQuizIds = await repo.GetPoolQuizIdsForQuestionsAsync(questionGuids);
            poolQuizIds = poolQuizIds.Union(parentQuizIds).Distinct().ToList();
        }

        if (poolQuizIds.Count > 0 && !await poolAuth.CanAccessPoolQuizzesAsync(UserId, UserRole, poolQuizIds))
            return Forbid();

        var test = await repo.CreateTestFromPoolAsync(UserId, request);
        return Ok(ApiResponse<QuizDto>.Ok(test, "Tổng hợp bài thi từ Pool thành công. Hãy kiểm duyệt và xuất bản trong AI Studio!"));
    }

    /// <summary>Teacher: Tổng hợp câu hỏi trong Pool để tạo bài test đầu vào</summary>
    [HttpPost("create-entry-test")]
    public async Task<IActionResult> CreateEntryTestFromPool([FromBody] CreateEntryTestFromPoolRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        if (UserRole != "teacher") return Forbid();

        if (request.QuestionIds.Count == 0 && request.PoolQuizIds.Count == 0)
            return BadRequest(ApiResponse.Fail("Cần chọn ít nhất một câu hỏi hoặc quiz trong pool"));

        var classId = Guid.Parse(request.ClassId);
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();

        if (await quizzes.HasEntryTestAsync(classId))
            return Conflict(ApiResponse.Fail("Lớp học đã có bài test đầu vào"));

        var poolQuizIds = request.PoolQuizIds.Select(Guid.Parse).ToList();
        if (request.QuestionIds.Count > 0)
        {
            var questionGuids = request.QuestionIds.Select(Guid.Parse).ToList();
            var parentQuizIds = await repo.GetPoolQuizIdsForQuestionsAsync(questionGuids);
            poolQuizIds = poolQuizIds.Union(parentQuizIds).Distinct().ToList();
        }

        if (poolQuizIds.Count > 0 && !await poolAuth.CanAccessPoolQuizzesAsync(UserId, UserRole, poolQuizIds))
            return Forbid();

        try
        {
            var test = await repo.CreateEntryTestFromPoolAsync(UserId, request);
            if (test == null)
                return Conflict(ApiResponse.Fail("Lớp học đã có bài test đầu vào"));

            return Ok(ApiResponse<QuizDto>.Ok(test, "Tạo bài test đầu vào từ Pool thành công. Hãy kiểm duyệt trong AI Studio!"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>Student: Tổng hợp câu hỏi trong Pool để tạo bộ Ôn tập cá nhân</summary>
    [HttpPost("create-revision-set")]
    public async Task<IActionResult> CreateRevisionSetFromPool([FromBody] CreateRevisionSetFromPoolRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        if (request.PoolQuizIds.Count == 0) return BadRequest(ApiResponse.Fail("Cần chọn ít nhất một quiz trong pool để tạo bộ ôn tập"));

        var poolIds = request.PoolQuizIds.Select(Guid.Parse).ToList();
        if (!await poolAuth.CanAccessPoolQuizzesAsync(UserId, UserRole, poolIds)) return Forbid();

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

    /// <summary>Đổi tên chủ đề trong Pool (chủ sở hữu hoặc giáo viên sở hữu lớp)</summary>
    [HttpPatch("topics/{topicId:guid}/rename")]
    public async Task<IActionResult> RenamePoolTopic(Guid topicId, [FromBody] RenamePoolTopicRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var result = await repo.RenameTopicAsync(UserId, UserRole, topicId, request.Name);
        if (result == null) return NotFound(ApiResponse.Fail("Không tìm thấy chủ đề hoặc bạn không có quyền đổi tên"));
        return Ok(ApiResponse<TopicPoolDto>.Ok(result, "Đổi tên chủ đề thành công"));
    }

    /// <summary>Đổi tên một lượt sinh quiz trong Pool (chủ sở hữu hoặc giáo viên sở hữu lớp)</summary>
    [HttpPatch("quizzes/{quizId:guid}/rename")]
    public async Task<IActionResult> RenamePoolQuiz(Guid quizId, [FromBody] RenamePoolQuizRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var result = await repo.RenamePoolQuizAsync(UserId, UserRole, quizId, request.Name);
        if (result == null) return NotFound(ApiResponse.Fail("Không tìm thấy quiz hoặc bạn không có quyền đổi tên"));
        return Ok(ApiResponse<PoolQuizDetailDto>.Ok(result, "Đổi tên quiz thành công"));
    }

    /// <summary>Sửa câu hỏi trong Pool (text, độ khó, β, options)</summary>
    [HttpPatch("questions/{questionId:guid}")]
    public async Task<IActionResult> UpdatePoolQuestion(Guid questionId, [FromBody] UpdateQuestionRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var question = await repo.GetPoolQuestionAsync(questionId);
        if (question == null) return NotFound(ApiResponse.Fail("Không tìm thấy câu hỏi trong Pool"));
        if (!await poolAuth.CanAccessTopicAsync(UserId, UserRole, question.TopicId))
            return Forbid();
        var updated = await quizzes.UpdateQuestionAsync(questionId, request);
        if (updated == null) return NotFound(ApiResponse.Fail("Không thể cập nhật câu hỏi"));
        return Ok(ApiResponse<QuestionDto>.Ok(updated, "Cập nhật câu hỏi thành công"));
    }
}
