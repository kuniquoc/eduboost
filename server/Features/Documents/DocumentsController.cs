using System.Security.Claims;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.Documents.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.Documents;

[ApiController]
[Authorize]
public class DocumentsController(IDocumentsRepository repo) : ControllerBase
{
    private Guid UserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());

    // ── Class documents ───────────────────────────────────────────────────────

    /// <summary>Teacher/Student: Lấy danh sách tài liệu của lớp</summary>
    [HttpGet("api/classes/{classId:guid}/documents")]
    public async Task<IActionResult> GetClassDocuments(Guid classId)
    {
        var docs = await repo.GetByClassIdAsync(classId);
        return Ok(ApiResponse<List<DocumentDto>>.Ok(docs));
    }

    /// <summary>
    /// Teacher: Bước 1 — Yêu cầu presigned URL để upload tài liệu lên MinIO.
    /// Client dùng URL này để PUT file trực tiếp lên MinIO, sau đó gọi /confirm.
    /// </summary>
    [HttpPost("api/classes/{classId:guid}/documents/request-upload")]
    public async Task<IActionResult> RequestClassUploadUrl(Guid classId, [FromBody] RequestUploadUrlRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var result = await repo.RequestClassUploadUrlAsync(classId, UserId, request);
        return Ok(ApiResponse<UploadUrlDto>.Ok(result, "Presigned URL tạo thành công. Upload file và gọi /confirm."));
    }

    /// <summary>
    /// Teacher: Bước 2 — Xác nhận đã upload xong, chuyển document sang trạng thái ready.
    /// </summary>
    [HttpPost("api/classes/{classId:guid}/documents/confirm")]
    public async Task<IActionResult> ConfirmClassUpload(Guid classId, [FromBody] ConfirmUploadRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var doc = await repo.ConfirmClassUploadAsync(classId, UserId, request.DocumentId);
        if (doc == null) return NotFound(ApiResponse.Fail("Không tìm thấy document hoặc không có quyền"));
        return Ok(ApiResponse<DocumentDto>.Ok(doc, "Upload tài liệu thành công"));
    }

    /// <summary>Teacher/Student: Lấy presigned URL để tải tài liệu</summary>
    [HttpGet("api/classes/{classId:guid}/documents/{id:guid}/download")]
    public async Task<IActionResult> GetDownloadUrl(Guid classId, Guid id)
    {
        var result = await repo.GetClassDocumentDownloadUrlAsync(classId, id);
        if (result == null) return NotFound(ApiResponse.Fail("Không tìm thấy tài liệu"));
        return Ok(ApiResponse<DownloadUrlDto>.Ok(result));
    }

    /// <summary>Teacher: Xoá tài liệu khỏi lớp (xoá cả file trong MinIO)</summary>
    [HttpDelete("api/classes/{classId:guid}/documents/{id:guid}")]
    public async Task<IActionResult> DeleteClassDocument(Guid classId, Guid id)
    {
        var ok = await repo.DeleteClassDocumentAsync(classId, id);
        if (!ok) return NotFound(ApiResponse.Fail("Không tìm thấy tài liệu"));
        return Ok(ApiResponse.Ok("Xoá tài liệu thành công"));
    }

    /// <summary>Teacher: Yêu cầu AI tạo quiz từ tài liệu</summary>
    [HttpPost("api/classes/{classId:guid}/documents/{id:guid}/generate-quiz")]
    public async Task<IActionResult> GenerateQuizFromDocument(Guid classId, Guid id, [FromBody] GenerateQuizRequest request)
    {
        var job = await repo.GenerateQuizFromDocumentAsync(classId, id, request.TopicId);
        return Ok(ApiResponse<GenerateQuizJobDto>.Ok(job, "Đã bắt đầu tạo quiz. AI đang xử lý..."));
    }

    // ── Student private documents ─────────────────────────────────────────────

    /// <summary>Student: Lấy tài liệu riêng</summary>
    [HttpGet("api/documents/my")]
    public async Task<IActionResult> GetMyDocuments()
    {
        var docs = await repo.GetMyDocumentsAsync(UserId);
        return Ok(ApiResponse<List<DocumentDto>>.Ok(docs));
    }

    /// <summary>Student: Bước 1 — Yêu cầu presigned URL để upload tài liệu riêng</summary>
    [HttpPost("api/documents/my/request-upload")]
    public async Task<IActionResult> RequestStudentUploadUrl([FromBody] RequestUploadUrlRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var result = await repo.RequestStudentUploadUrlAsync(UserId, request);
        return Ok(ApiResponse<UploadUrlDto>.Ok(result, "Presigned URL tạo thành công"));
    }

    /// <summary>Student: Bước 2 — Xác nhận upload tài liệu riêng</summary>
    [HttpPost("api/documents/my/confirm")]
    public async Task<IActionResult> ConfirmStudentUpload([FromBody] ConfirmUploadRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var doc = await repo.ConfirmStudentUploadAsync(UserId, request.DocumentId);
        if (doc == null) return NotFound(ApiResponse.Fail("Không tìm thấy document hoặc không có quyền"));
        return Ok(ApiResponse<DocumentDto>.Ok(doc, "Upload tài liệu thành công"));
    }

    /// <summary>Student: Lấy presigned URL tải tài liệu riêng</summary>
    [HttpGet("api/documents/my/{id:guid}/download")]
    public async Task<IActionResult> GetMyDocumentDownloadUrl(Guid id)
    {
        var result = await repo.GetStudentDocumentDownloadUrlAsync(UserId, id);
        if (result == null) return NotFound(ApiResponse.Fail("Không tìm thấy tài liệu"));
        return Ok(ApiResponse<DownloadUrlDto>.Ok(result));
    }

    /// <summary>Student: AI tạo quiz từ tài liệu riêng</summary>
    [HttpPost("api/documents/my/{id:guid}/generate-quiz")]
    public async Task<IActionResult> GenerateMyQuiz(Guid id)
    {
        var job = await repo.GenerateMyQuizAsync(id);
        return Ok(ApiResponse<GenerateQuizJobDto>.Ok(job, "AI đang tạo quiz riêng cho bạn..."));
    }

    /// <summary>Student: Xoá tài liệu riêng (xoá cả file trong MinIO)</summary>
    [HttpDelete("api/documents/my/{id:guid}")]
    public async Task<IActionResult> DeleteMyDocument(Guid id)
    {
        var ok = await repo.DeleteMyDocumentAsync(UserId, id);
        if (!ok) return NotFound(ApiResponse.Fail("Không tìm thấy tài liệu"));
        return Ok(ApiResponse.Ok("Xoá tài liệu thành công"));
    }
}
