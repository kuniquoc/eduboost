namespace EduBoost.API.Features.Documents;

public interface IDocumentIngestQueue
{
    ValueTask EnqueueAsync(DocumentIngestJob job, CancellationToken cancellationToken = default);
}
