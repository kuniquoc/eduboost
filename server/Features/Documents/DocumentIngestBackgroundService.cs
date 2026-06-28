using System.Threading.Channels;
using EduBoost.API.Infrastructure;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using EduBoost.API.Infrastructure.Integrations.Storage;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Documents;

public sealed class DocumentIngestQueue : IDocumentIngestQueue
{
    private readonly Channel<DocumentIngestJob> _channel = Channel.CreateUnbounded<DocumentIngestJob>(
        new UnboundedChannelOptions { SingleReader = true, SingleWriter = false });

    internal ChannelReader<DocumentIngestJob> Reader => _channel.Reader;

    public ValueTask EnqueueAsync(DocumentIngestJob job, CancellationToken cancellationToken = default) =>
        _channel.Writer.WriteAsync(job, cancellationToken);
}

public sealed class DocumentIngestBackgroundService(
    DocumentIngestQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<DocumentIngestBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Document ingest background worker started");

        await foreach (var job in queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await ProcessJobAsync(job, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Unhandled error processing ingest job for document {DocId}", job.DocumentId);
            }
        }

        logger.LogInformation("Document ingest background worker stopped");
    }

    private async Task ProcessJobAsync(DocumentIngestJob job, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var agent = scope.ServiceProvider.GetRequiredService<IAgentService>();
        var storage = scope.ServiceProvider.GetRequiredService<IStorageService>();

        var doc = await db.Documents.FindAsync([job.DocumentId], cancellationToken);
        if (doc == null)
        {
            logger.LogWarning("Ingest job skipped: document {DocId} not found", job.DocumentId);
            return;
        }

        if (doc.Status is not ("ingesting" or "processing"))
        {
            logger.LogInformation(
                "Ingest job skipped: document {DocId} status is {Status}",
                job.DocumentId, doc.Status);
            return;
        }

        try
        {
            var downloadUrl = await ResolveDownloadUrlAsync(doc, storage);
            if (downloadUrl == null)
            {
                doc.Status = "ingest_failed";
                await db.SaveChangesAsync(cancellationToken);
                return;
            }

            await agent.IngestDocumentAsync(
                documentId: doc.Id.ToString(),
                fileUrl: downloadUrl,
                scope: job.DocumentScope,
                classId: job.ClassId,
                ownerId: job.OwnerId,
                topicId: job.TopicId);

            doc.Status = "ready";
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Document {DocId} ingested successfully", job.DocumentId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to ingest document {DocId}", job.DocumentId);
            doc.Status = "ingest_failed";
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private static async Task<string?> ResolveDownloadUrlAsync(
        Infrastructure.Entities.Document doc,
        IStorageService storage)
    {
        if (doc.StorageKey == null) return null;

        var bucket = doc.Scope == "student"
            ? MinioStorageService.Buckets.StudentDocuments
            : MinioStorageService.Buckets.ClassDocuments;

        return await storage.GetInternalPresignedDownloadUrlAsync(bucket, doc.StorageKey, 3600);
    }
}
