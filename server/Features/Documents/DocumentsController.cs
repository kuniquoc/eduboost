using EduBoost.API.Common.Http;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.Classes;
using EduBoost.API.Features.Documents.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.Documents;

[ApiController]
[Authorize]
[Route("api")]
public class DocumentsController(IDocumentsRepository repo, IClassesRepository classes) : ControllerBase
{
    private Guid UserId => ControllerAuth.GetUserId(User);
    private string UserRole => ControllerAuth.GetUserRole(User);

    // ── Class documents ───────────────────────────────────────────────────────

    /// <summary>Teacher/Student: Lấy danh sách tài liệu của lớp</summary>
    [HttpGet("classes/{classId:guid}/documents")]
    public async Task<IActionResult> GetClassDocuments(Guid classId)
    {
        if (!await classes.CanUserAccessClassAsync(classId, UserId, UserRole))
            return Forbid();
        var docs = await repo.GetByClassIdAsync(classId);
        return Ok(ApiResponse<List<DocumentDto>>.Ok(docs));
    }

    /// <summary>Teacher: Bước 1 — Yêu cầu presigned URL upload</summary>
    [HttpPost("classes/{classId:guid}/documents/request-upload")]
    public async Task<IActionResult> RequestClassUploadUrl(Guid classId, [FromBody] RequestUploadUrlRequest request)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var result = await repo.RequestClassUploadUrlAsync(classId, UserId, request);
        return Ok(ApiResponse<UploadUrlDto>.Ok(result, "Presigned URL tạo thành công. Upload file và gọi /confirm."));
    }

    /// <summary>Teacher: Bước 2 — Xác nhận upload, bắt đầu ingest RAG</summary>
    [HttpPost("classes/{classId:guid}/documents/confirm")]
    public async Task<IActionResult> ConfirmClassUpload(Guid classId, [FromBody] ConfirmUploadRequest request)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var doc = await repo.ConfirmClassUploadAsync(classId, UserId, request.DocumentId);
        if (doc == null) return NotFound(ApiResponse.Fail("Không tìm thấy document hoặc không có quyền"));
        return Ok(ApiResponse<DocumentDto>.Ok(doc, "Upload tài liệu thành công"));
    }

    /// <summary>Teacher/Student: Lấy presigned URL tải tài liệu</summary>
    [HttpGet("classes/{classId:guid}/documents/{id:guid}/download")]
    public async Task<IActionResult> GetDownloadUrl(Guid classId, Guid id)
    {
        if (!await classes.CanUserAccessClassAsync(classId, UserId, UserRole))
            return Forbid();
        var result = await repo.GetClassDocumentDownloadUrlAsync(classId, id);
        if (result == null) return NotFound(ApiResponse.Fail("Không tìm thấy tài liệu"));
        return Ok(ApiResponse<DownloadUrlDto>.Ok(result));
    }

    /// <summary>Teacher: Xoá tài liệu khỏi lớp</summary>
    [HttpDelete("classes/{classId:guid}/documents/{id:guid}")]
    public async Task<IActionResult> DeleteClassDocument(Guid classId, Guid id)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        var ok = await repo.DeleteClassDocumentAsync(classId, id);
        if (!ok) return NotFound(ApiResponse.Fail("Không tìm thấy tài liệu"));
        return Ok(ApiResponse.Ok("Xoá tài liệu thành công"));
    }

    /// <summary>Teacher: Gán hoặc bỏ chủ đề cho tài liệu</summary>
    [HttpPatch("classes/{classId:guid}/documents/{id:guid}/topic")]
    public async Task<IActionResult> UpdateDocumentTopic(Guid classId, Guid id, [FromBody] UpdateDocumentTopicRequest request)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        var doc = await repo.UpdateDocumentTopicAsync(classId, id, request.TopicId);
        if (doc == null) return NotFound(ApiResponse.Fail("Không tìm thấy tài liệu"));
        return Ok(ApiResponse<DocumentDto>.Ok(doc));
    }

    /// <summary>Teacher: Bật/tắt hiển thị tài liệu cho học sinh</summary>
    [HttpPatch("classes/{classId:guid}/documents/{id:guid}/visibility")]
    public async Task<IActionResult> UpdateDocumentVisibility(Guid classId, Guid id, [FromBody] UpdateDocumentVisibilityRequest request)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        var doc = await repo.UpdateDocumentVisibilityAsync(classId, id, request.IsVisible);
        if (doc == null) return NotFound(ApiResponse.Fail("Không tìm thấy tài liệu"));
        return Ok(ApiResponse<DocumentDto>.Ok(doc));
    }

    /// <summary>Teacher: Yêu cầu AI tạo quiz từ tài liệu</summary>
    [HttpPost("classes/{classId:guid}/documents/{id:guid}/generate-quiz")]
    public async Task<IActionResult> GenerateQuizFromDocument(Guid classId, Guid id, [FromBody] GenerateQuizRequest request)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        var job = await repo.GenerateQuizFromDocumentAsync(classId, id, request);
        if (job.Status == "error")
        {
            if ((job.Message ?? string.Empty).Contains("Không tìm thấy", StringComparison.OrdinalIgnoreCase))
                return NotFound(ApiResponse.Fail(job.Message ?? "Không tìm thấy tài liệu"));

            return StatusCode(502, ApiResponse.Fail(job.Message ?? "Không thể tạo quiz từ tài liệu"));
        }

        return Ok(ApiResponse<GenerateQuizJobDto>.Ok(job, "Đã bắt đầu tạo quiz. AI đang xử lý..."));
    }

    // ── Student private documents ─────────────────────────────────────────────

    /// <summary>Student: Lấy tài liệu riêng</summary>
    [HttpGet("documents/my")]
    public async Task<IActionResult> GetMyDocuments()
    {
        if (UserRole != "student") return Forbid();
        var docs = await repo.GetMyDocumentsAsync(UserId);
        return Ok(ApiResponse<List<DocumentDto>>.Ok(docs));
    }

    /// <summary>Student: Bước 1 — Yêu cầu presigned URL upload riêng</summary>
    [HttpPost("documents/my/request-upload")]
    public async Task<IActionResult> RequestStudentUploadUrl([FromBody] RequestUploadUrlRequest request)
    {
        if (UserRole != "student") return Forbid();
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var result = await repo.RequestStudentUploadUrlAsync(UserId, request);
        return Ok(ApiResponse<UploadUrlDto>.Ok(result, "Presigned URL tạo thành công"));
    }

    /// <summary>Student: Bước 2 — Xác nhận upload riêng</summary>
    [HttpPost("documents/my/confirm")]
    public async Task<IActionResult> ConfirmStudentUpload([FromBody] ConfirmUploadRequest request)
    {
        if (UserRole != "student") return Forbid();
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var doc = await repo.ConfirmStudentUploadAsync(UserId, request.DocumentId);
        if (doc == null) return NotFound(ApiResponse.Fail("Không tìm thấy document hoặc không có quyền"));
        return Ok(ApiResponse<DocumentDto>.Ok(doc, "Upload tài liệu thành công"));
    }

    /// <summary>Student: Lấy presigned URL tải tài liệu riêng</summary>
    [HttpGet("documents/my/{id:guid}/download")]
    public async Task<IActionResult> GetMyDocumentDownloadUrl(Guid id)
    {
        if (UserRole != "student") return Forbid();
        var result = await repo.GetStudentDocumentDownloadUrlAsync(UserId, id);
        if (result == null) return NotFound(ApiResponse.Fail("Không tìm thấy tài liệu"));
        return Ok(ApiResponse<DownloadUrlDto>.Ok(result));
    }

    /// <summary>Student: AI tạo quiz từ tài liệu riêng</summary>
    [HttpPost("documents/my/{id:guid}/generate-quiz")]
    public async Task<IActionResult> GenerateMyQuiz(Guid id, [FromBody] GenerateQuizRequest request)
    {
        if (UserRole != "student") return Forbid();
        var job = await repo.GenerateMyQuizAsync(UserId, id, request);
        if (job.Status == "error")
        {
            if ((job.Message ?? string.Empty).Contains("Không tìm thấy", StringComparison.OrdinalIgnoreCase))
                return NotFound(ApiResponse.Fail(job.Message ?? "Không tìm thấy tài liệu"));

            return StatusCode(502, ApiResponse.Fail(job.Message ?? "Không thể tạo quiz cá nhân"));
        }

        return Ok(ApiResponse<GenerateQuizJobDto>.Ok(job, "AI đang tạo quiz riêng cho bạn..."));
    }

    /// <summary>Student: Xoá tài liệu riêng</summary>
    [HttpDelete("documents/my/{id:guid}")]
    public async Task<IActionResult> DeleteMyDocument(Guid id)
    {
        if (UserRole != "student") return Forbid();
        var ok = await repo.DeleteMyDocumentAsync(UserId, id);
        if (!ok) return NotFound(ApiResponse.Fail("Không tìm thấy tài liệu"));
        return Ok(ApiResponse.Ok("Xoá tài liệu thành công"));
    }
}
