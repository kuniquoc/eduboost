using Minio;
using Minio.DataModel.Args;

namespace EduBoost.API.Infrastructure.Storage;

public class MinioStorageService : IStorageService
{
    private readonly IMinioClient _minio;
    private readonly ILogger<MinioStorageService> _logger;

    public static class Buckets
    {
        public const string ClassDocuments = "eduboost-class-docs";
        public const string StudentDocuments = "eduboost-student-docs";
    }

    public MinioStorageService(IConfiguration config, ILogger<MinioStorageService> logger)
    {
        _logger = logger;

        var endpoint = config["MinIO:Endpoint"] ?? "localhost:9000";
        var accessKey = config["MinIO:AccessKey"] ?? "minioadmin";
        var secretKey = config["MinIO:SecretKey"] ?? "minioadmin";
        var useSSL = bool.TryParse(config["MinIO:UseSSL"], out var ssl) && ssl;

        _minio = new MinioClient()
            .WithEndpoint(endpoint)
            .WithCredentials(accessKey, secretKey)
            .WithSSL(useSSL)
            .Build();
    }

    public async Task<string> GetPresignedUploadUrlAsync(
        string bucket, string objectKey, int expirySeconds = 600)
    {
        await EnsureBucketExistsAsync(bucket);

        var args = new PresignedPutObjectArgs()
            .WithBucket(bucket)
            .WithObject(objectKey)
            .WithExpiry(expirySeconds);

        var url = await _minio.PresignedPutObjectAsync(args);
        _logger.LogDebug("Generated upload presigned URL for {Bucket}/{Key}", bucket, objectKey);
        return url;
    }

    public async Task<string> GetPresignedDownloadUrlAsync(
        string bucket, string objectKey, int expirySeconds = 3600)
    {
        var args = new PresignedGetObjectArgs()
            .WithBucket(bucket)
            .WithObject(objectKey)
            .WithExpiry(expirySeconds);

        var url = await _minio.PresignedGetObjectAsync(args);
        _logger.LogDebug("Generated download presigned URL for {Bucket}/{Key}", bucket, objectKey);
        return url;
    }

    public async Task DeleteObjectAsync(string bucket, string objectKey)
    {
        var args = new RemoveObjectArgs()
            .WithBucket(bucket)
            .WithObject(objectKey);

        await _minio.RemoveObjectAsync(args);
        _logger.LogInformation("Deleted object {Bucket}/{Key} from MinIO", bucket, objectKey);
    }

    public async Task EnsureBucketExistsAsync(string bucket)
    {
        var existsArgs = new BucketExistsArgs().WithBucket(bucket);
        var exists = await _minio.BucketExistsAsync(existsArgs);

        if (!exists)
        {
            var makeArgs = new MakeBucketArgs().WithBucket(bucket);
            await _minio.MakeBucketAsync(makeArgs);
            _logger.LogInformation("Created MinIO bucket: {Bucket}", bucket);
        }
    }

    public async Task UploadObjectAsync(string bucket, string objectKey, System.IO.Stream dataStream, string contentType)
    {
        await EnsureBucketExistsAsync(bucket);

        var args = new PutObjectArgs()
            .WithBucket(bucket)
            .WithObject(objectKey)
            .WithStreamData(dataStream)
            .WithObjectSize(dataStream.Length)
            .WithContentType(contentType);

        await _minio.PutObjectAsync(args);
        _logger.LogInformation("Successfully uploaded direct object {Bucket}/{Key} to MinIO", bucket, objectKey);
    }
}
