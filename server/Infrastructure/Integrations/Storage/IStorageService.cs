namespace EduBoost.API.Infrastructure.Integrations.Storage;

public interface IStorageService
{
    /// <summary>Tạo presigned URL để client upload trực tiếp lên MinIO.</summary>
    Task<string> GetPresignedUploadUrlAsync(string bucket, string objectKey, int expirySeconds = 600);

    /// <summary>Tạo presigned URL để client download file.</summary>
    Task<string> GetPresignedDownloadUrlAsync(string bucket, string objectKey, int expirySeconds = 3600);

    /// <summary>Tạo presigned URL dùng endpoint nội bộ Docker (cho AI agent tải file).</summary>
    Task<string> GetInternalPresignedDownloadUrlAsync(string bucket, string objectKey, int expirySeconds = 3600);

    /// <summary>Xóa object khỏi MinIO.</summary>
    Task DeleteObjectAsync(string bucket, string objectKey);

    /// <summary>Đảm bảo bucket tồn tại (tạo nếu chưa có).</summary>
    Task EnsureBucketExistsAsync(string bucket);

    /// <summary>Upload trực tiếp một object từ stream.</summary>
    Task UploadObjectAsync(string bucket, string objectKey, System.IO.Stream dataStream, string contentType);
}
