using EduBoost.API.Common.Http;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.Classes;
using EduBoost.API.Features.Topics.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.Topics;

[ApiController]
[Route("api/classes/{classId:guid}/topics")]
[Authorize]
public class TopicsController(ITopicsRepository repo, IClassesRepository classes) : ControllerBase
{
    private Guid UserId => ControllerAuth.GetUserId(User);
    private string UserRole => ControllerAuth.GetUserRole(User);

    /// <summary>Lấy danh sách topic (knowledge base) của lớp</summary>
    [HttpGet]
    public async Task<IActionResult> GetTopics(Guid classId)
    {
        if (!await classes.CanUserAccessClassAsync(classId, UserId, UserRole))
            return Forbid();
        var topics = await repo.GetByClassIdAsync(classId);
        return Ok(ApiResponse<List<TopicDto>>.Ok(topics));
    }

    /// <summary>Teacher: Tạo topic mới trong lớp</summary>
    [HttpPost]
    public async Task<IActionResult> CreateTopic(Guid classId, [FromBody] CreateTopicRequest request)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var topic = await repo.CreateAsync(classId, request);
        return CreatedAtAction(nameof(GetTopics), new { classId }, ApiResponse<TopicDto>.Ok(topic, "Tạo topic thành công"));
    }

    /// <summary>Teacher: Cập nhật tên/mô tả topic</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateTopic(Guid classId, Guid id, [FromBody] UpdateTopicRequest request)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        if (!await repo.BelongsToClassAsync(id, classId)) return NotFound(ApiResponse.Fail($"Không tìm thấy topic '{id}'"));
        var topic = await repo.UpdateAsync(id, request);
        if (topic == null) return NotFound(ApiResponse.Fail($"Không tìm thấy topic '{id}'"));
        return Ok(ApiResponse<TopicDto>.Ok(topic, "Cập nhật thành công"));
    }

    /// <summary>Teacher: Xoá topic</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteTopic(Guid classId, Guid id)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        if (!await repo.BelongsToClassAsync(id, classId)) return NotFound(ApiResponse.Fail($"Không tìm thấy topic '{id}'"));
        var ok = await repo.DeleteAsync(id);
        if (!ok) return NotFound(ApiResponse.Fail($"Không tìm thấy topic '{id}'"));
        return Ok(ApiResponse.Ok("Xoá topic thành công"));
    }

    /// <summary>Teacher: Yêu cầu AI đánh giá độ khó cho tất cả topic trong lớp</summary>
    [HttpPost("ai-evaluate")]
    public async Task<IActionResult> AiEvaluate(Guid classId)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        var topics = await repo.AiEvaluateAsync(classId);
        return Ok(ApiResponse<List<TopicDto>>.Ok(topics, "AI đã đánh giá xong độ khó cho tất cả topic"));
    }

    /// <summary>Teacher: Chỉnh sửa độ khó của topic thủ công</summary>
    [HttpPut("{id:guid}/difficulty")]
    public async Task<IActionResult> UpdateDifficulty(Guid classId, Guid id, [FromBody] UpdateDifficultyRequest request)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        if (request.Difficulty is not ("easy" or "medium" or "hard"))
            return BadRequest(ApiResponse.Fail("Độ khó phải là 'easy', 'medium' hoặc 'hard'"));
        if (!await repo.BelongsToClassAsync(id, classId)) return NotFound(ApiResponse.Fail($"Không tìm thấy topic '{id}'"));
        var topic = await repo.UpdateDifficultyAsync(id, request.Difficulty);
        if (topic == null) return NotFound(ApiResponse.Fail($"Không tìm thấy topic '{id}'"));
        return Ok(ApiResponse<TopicDto>.Ok(topic, "Cập nhật độ khó thành công"));
    }

    /// <summary>Teacher: Bật/tắt quyền xem document của topic cho học sinh</summary>
    [HttpPatch("{id:guid}/visibility")]
    public async Task<IActionResult> UpdateVisibility(Guid classId, Guid id, [FromBody] UpdateVisibilityRequest request)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        if (!await repo.BelongsToClassAsync(id, classId)) return NotFound(ApiResponse.Fail($"Không tìm thấy topic '{id}'"));
        var topic = await repo.UpdateVisibilityAsync(id, request.IsDocumentVisible);
        if (topic == null) return NotFound(ApiResponse.Fail($"Không tìm thấy topic '{id}'"));
        return Ok(ApiResponse<TopicDto>.Ok(topic, request.IsDocumentVisible ? "Đã bật xem document" : "Đã tắt xem document"));
    }
}
