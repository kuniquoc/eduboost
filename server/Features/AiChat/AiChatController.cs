using EduBoost.API.Common.Http;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.AiChat.Models;
using EduBoost.API.Features.Quizzes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.AiChat;

[ApiController]
[Route("api/ai-chat")]
[Authorize]
public class AiChatController(IAiChatRepository repo, IQuizAuthorization quizAuth) : ControllerBase
{
    private Guid UserId => ControllerAuth.GetUserId(User);
    private string UserRole => ControllerAuth.GetUserRole(User);

    /// <summary>Student: Gửi câu hỏi → AI trả lời (có RAG context + source references)</summary>
    [HttpPost("ask")]
    public async Task<IActionResult> Ask([FromBody] AskRequest request)
    {
        if (UserRole != "student") return Forbid();
        if (request.TopicId.HasValue && !await quizAuth.CanStudentAccessTopicAsync(request.TopicId.Value, UserId))
            return Forbid();
        var result = await repo.AskAsync(UserId, request);
        return Ok(ApiResponse<AskResponse>.Ok(result));
    }

    /// <summary>Student: Lấy lịch sử hội thoại theo topic</summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] Guid? topicId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (UserRole != "student") return Forbid();
        if (topicId.HasValue && !await quizAuth.CanStudentAccessTopicAsync(topicId.Value, UserId))
            return Forbid();
        var history = await repo.GetHistoryAsync(UserId, topicId, page, pageSize);
        return Ok(ApiResponse<ChatHistoryDto>.Ok(history));
    }

    /// <summary>Student: Xóa toàn bộ lịch sử hội thoại</summary>
    [HttpDelete("history")]
    public async Task<IActionResult> ClearHistory()
    {
        if (UserRole != "student") return Forbid();
        await repo.ClearHistoryAsync(UserId);
        return Ok(ApiResponse.Ok("Đã xóa lịch sử trò chuyện"));
    }
}
