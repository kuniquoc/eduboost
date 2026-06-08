using System.Security.Claims;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.AiChat.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.AiChat;

[ApiController]
[Route("api/ai-chat")]
[Authorize]
public class AiChatController(IAiChatRepository repo) : ControllerBase
{
    private Guid UserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());

    /// <summary>Gửi câu hỏi → AI trả lời (có RAG context + source references)</summary>
    [HttpPost("ask")]
    public async Task<IActionResult> Ask([FromBody] AskRequest request)
    {
        var result = await repo.AskAsync(UserId, request);
        return Ok(ApiResponse<AskResponse>.Ok(result));
    }

    /// <summary>Lấy lịch sử hội thoại theo topic</summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] Guid? topicId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var history = await repo.GetHistoryAsync(UserId, topicId, page, pageSize);
        return Ok(ApiResponse<ChatHistoryDto>.Ok(history));
    }

    /// <summary>Xóa toàn bộ lịch sử hội thoại</summary>
    [HttpDelete("history")]
    public async Task<IActionResult> ClearHistory()
    {
        await repo.ClearHistoryAsync(UserId);
        return Ok(ApiResponse.Ok("Đã xóa lịch sử trò chuyện"));
    }
}
