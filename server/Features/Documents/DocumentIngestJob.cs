namespace EduBoost.API.Features.Documents;

public sealed record DocumentIngestJob(
    Guid DocumentId,
    string DocumentScope,
    string? ClassId = null,
    string? TopicId = null,
    string? OwnerId = null);
