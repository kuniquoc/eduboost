using System.ComponentModel.DataAnnotations;

namespace EduBoost.API.Features.Documents.Models;

public class DocumentDto
{
    public string Id { get; set; } = "";
    public string OwnerId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Size { get; set; } = "";
    public string Status { get; set; } = "pending"; // "pending" | "uploading" | "processing" | "ready" | "error"
    public string UploadedAt { get; set; } = "";
    public string? TopicId { get; set; }
    public string? GeneratedQuizId { get; set; }
    public string? ClassId { get; set; }
    public string Scope { get; set; } = "class"; // "class" | "student"
}

/// <summary>Yêu cầu tạo presigned upload URL.</summary>
public class RequestUploadUrlRequest
{
    [Required] public string FileName { get; set; } = "";
    [Required] public string FileSize { get; set; } = "";
    public string? TopicId { get; set; }
}

/// <summary>Phản hồi chứa presigned URL để client upload thẳng lên MinIO.</summary>
public class UploadUrlDto
{
    public string DocumentId { get; set; } = "";
    public string UploadUrl { get; set; } = "";
    public int ExpiresInSeconds { get; set; } = 600;
}

/// <summary>Sau khi upload xong, client gọi API này để xác nhận.</summary>
public class ConfirmUploadRequest
{
    [Required] public string DocumentId { get; set; } = "";
}

public class GenerateQuizRequest
{
    public string? TopicId { get; set; }
    public int NumQuestions { get; set; } = 10;
    public string Difficulty { get; set; } = "medium";
    public string Mode { get; set; } = "create"; // "create" | "append" | "retry"
    public int? NumEasyQuestions { get; set; }
    public int? NumMediumQuestions { get; set; }
    public int? NumHardQuestions { get; set; }
}

public class GenerateQuizJobDto
{
    public string JobId { get; set; } = "";
    public string Status { get; set; } = "processing";
    public string? QuizId { get; set; }
    public string Message { get; set; } = "";
}

/// <summary>Presigned download URL cho một document.</summary>
public class DownloadUrlDto
{
    public string DownloadUrl { get; set; } = "";
    public int ExpiresInSeconds { get; set; } = 3600;
}
