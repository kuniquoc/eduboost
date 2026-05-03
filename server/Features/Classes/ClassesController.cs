using System.Security.Claims;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.Classes.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.Classes;

[ApiController]
[Route("api/classes")]
[Authorize]
public class ClassesController(IClassesRepository repo) : ControllerBase
{
    private Guid UserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());

    /// <summary>Teacher: Lấy danh sách lớp học của mình</summary>
    [HttpGet]
    public async Task<IActionResult> GetClasses()
    {
        var classes = await repo.GetByTeacherIdAsync(UserId);
        return Ok(ApiResponse<List<ClassDto>>.Ok(classes));
    }

    /// <summary>Teacher: Tạo lớp học mới</summary>
    [HttpPost]
    public async Task<IActionResult> CreateClass([FromBody] CreateClassRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var cls = await repo.CreateAsync(UserId, request);
        return CreatedAtAction(nameof(GetClass), new { id = cls.Id }, ApiResponse<ClassDto>.Ok(cls, "Tạo lớp học thành công"));
    }

    /// <summary>Lấy chi tiết lớp học (kèm danh sách topic)</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetClass(Guid id)
    {
        var cls = await repo.GetByIdAsync(id);
        if (cls == null) return NotFound(ApiResponse.Fail($"Không tìm thấy lớp học '{id}'"));
        return Ok(ApiResponse<ClassDetailDto>.Ok(cls));
    }

    /// <summary>Teacher: Cập nhật lớp học</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateClass(Guid id, [FromBody] UpdateClassRequest request)
    {
        var cls = await repo.UpdateAsync(id, request);
        if (cls == null) return NotFound(ApiResponse.Fail($"Không tìm thấy lớp học '{id}'"));
        return Ok(ApiResponse<ClassDto>.Ok(cls, "Cập nhật thành công"));
    }

    /// <summary>Teacher: Xoá lớp học</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteClass(Guid id)
    {
        var ok = await repo.DeleteAsync(id);
        if (!ok) return NotFound(ApiResponse.Fail($"Không tìm thấy lớp học '{id}'"));
        return Ok(ApiResponse.Ok("Xoá lớp học thành công"));
    }

    /// <summary>Teacher: Lấy danh sách học sinh trong lớp</summary>
    [HttpGet("{id:guid}/students")]
    public async Task<IActionResult> GetStudents(Guid id, [FromQuery] string? search)
    {
        var students = await repo.GetStudentsAsync(id, search);
        return Ok(ApiResponse<List<StudentEnrollmentDto>>.Ok(students));
    }

    /// <summary>Teacher: Thêm học sinh vào lớp bằng email</summary>
    [HttpPost("{id:guid}/students")]
    public async Task<IActionResult> AddStudent(Guid id, [FromBody] EnrollStudentRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var ok = await repo.AddStudentAsync(id, request.StudentEmail);
        if (!ok) return NotFound(ApiResponse.Fail("Không tìm thấy học sinh với email này"));
        return Ok(ApiResponse.Ok("Thêm học sinh thành công"));
    }

    /// <summary>Teacher: Xoá học sinh khỏi lớp</summary>
    [HttpDelete("{id:guid}/students/{studentId:guid}")]
    public async Task<IActionResult> RemoveStudent(Guid id, Guid studentId)
    {
        var ok = await repo.RemoveStudentAsync(id, studentId);
        if (!ok) return NotFound(ApiResponse.Fail("Học sinh không có trong lớp"));
        return Ok(ApiResponse.Ok("Xoá học sinh thành công"));
    }

    /// <summary>Student: Lấy danh sách lớp đang tham gia</summary>
    [HttpGet("enrolled")]
    public async Task<IActionResult> GetEnrolled()
    {
        var classes = await repo.GetEnrolledByStudentIdAsync(UserId);
        return Ok(ApiResponse<List<ClassDto>>.Ok(classes));
    }

    /// <summary>Student: Tham gia lớp học bằng mã code</summary>
    [HttpPost("join")]
    public async Task<IActionResult> JoinClass([FromBody] JoinClassRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var cls = await repo.JoinByCodeAsync(UserId, request.ClassCode);
        if (cls == null) return NotFound(ApiResponse.Fail("Mã lớp học không hợp lệ hoặc không tồn tại"));
        return Ok(ApiResponse<ClassDto>.Ok(cls, $"Tham gia lớp '{cls.Name}' thành công"));
    }
}
