using System.Text.Json;
using EduBoost.API.Features.AiChat.Models;
using EduBoost.API.Features.Documents;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.AiChat;

public interface IAiChatRepository
{
    Task<AskResponse> AskAsync(Guid userId, AskRequest request);
    Task<ChatHistoryDto> GetHistoryAsync(Guid userId, Guid? topicId, int page, int pageSize);
    Task ClearHistoryAsync(Guid userId);
}

public class AiChatRepository(AppDbContext db, IAgentService agentService, IDocumentsRepository docRepo) : IAiChatRepository
{
    private static readonly JsonSerializerOptions SourceReferenceJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    public async Task<AskResponse> AskAsync(Guid userId, AskRequest request)
    {
        // Save user message
        var userMessage = new ConversationMessage
        {
            UserId = userId,
            TopicId = request.TopicId,
            Role = "user",
            Content = request.Question
        };
        db.ConversationMessages.Add(userMessage);

        // Get user profile for context
        var profile = await db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        var level = profile?.CurrentLevel ?? "intermediate";

        // Get recent conversation history for context
        var recentMessages = await db.ConversationMessages
            .Where(m => m.UserId == userId && m.TopicId == request.TopicId)
            .OrderByDescending(m => m.CreatedAt)
            .Take(5)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new { m.Role, m.Content })
            .ToListAsync();

        // Calculate allowed document IDs for security-filtered RAG
        var allowedDocIds = await docRepo.GetAllowedDocumentIdsAsync(userId);
        var allowedScopes = new List<string> { "system" };

        // Call AI Agent Service
        var agentResponse = await agentService.AskAsync(
            request.Question,
            request.TopicId?.ToString(),
            level,
            recentMessages.Select(m => new ChatMessage { Role = m.Role, Content = m.Content }).ToList(),
            allowedDocIds,
            allowedScopes
        );

        var normalizedSources = await NormalizeSourcesAsync(agentResponse.Sources.Select(s => new SourceReferenceDto
        {
            DocumentId = s.DocumentId,
            FileName = s.FileName,
            Snippet = s.Snippet
        }).ToList());

        // Save assistant response
        var assistantMessage = new ConversationMessage
        {
            UserId = userId,
            TopicId = request.TopicId,
            Role = "assistant",
            Content = agentResponse.Answer,
            SourceReferencesJson = normalizedSources.Count > 0
                ? JsonSerializer.Serialize(normalizedSources, SourceReferenceJsonOptions)
                : null
        };
        db.ConversationMessages.Add(assistantMessage);
        await db.SaveChangesAsync();

        return new AskResponse
        {
            Answer = agentResponse.Answer,
            Sources = normalizedSources,
            MessageId = assistantMessage.Id.ToString()
        };
    }

    public async Task<ChatHistoryDto> GetHistoryAsync(Guid userId, Guid? topicId, int page, int pageSize)
    {
        var query = db.ConversationMessages
            .Where(m => m.UserId == userId);

        if (topicId != null)
            query = query.Where(m => m.TopicId == topicId);

        var total = await query.CountAsync();

        var messages = await query
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

        var parsedSourcesByMessage = messages.Select(m =>
            string.IsNullOrEmpty(m.SourceReferencesJson)
                ? []
                : JsonSerializer.Deserialize<List<SourceReferenceDto>>(
                    m.SourceReferencesJson,
                    SourceReferenceJsonOptions
                ) ?? []
        ).ToList();

        var docNameById = await BuildDocumentNameMapAsync(parsedSourcesByMessage.SelectMany(s => s));

        return new ChatHistoryDto
        {
            Total = total,
            Messages = messages.Select((m, idx) => new ChatMessageDto
            {
                Id = m.Id.ToString(),
                Role = m.Role,
                Content = m.Content,
                Sources = NormalizeSources(parsedSourcesByMessage[idx], docNameById),
                CreatedAt = m.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")
            }).ToList()
        };
    }

    public async Task ClearHistoryAsync(Guid userId)
    {
        await db.ConversationMessages
            .Where(m => m.UserId == userId)
            .ExecuteDeleteAsync();
    }

    private async Task<List<SourceReferenceDto>> NormalizeSourcesAsync(List<SourceReferenceDto> sources)
    {
        var docNameById = await BuildDocumentNameMapAsync(sources);
        return NormalizeSources(sources, docNameById);
    }

    private async Task<Dictionary<string, string>> BuildDocumentNameMapAsync(IEnumerable<SourceReferenceDto> sources)
    {
        var parsedDocIds = sources
            .Select(s => s.DocumentId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => Guid.TryParse(id, out var parsed) ? parsed : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        if (parsedDocIds.Count == 0)
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var documents = await db.Documents
            .Where(d => parsedDocIds.Contains(d.Id))
            .Select(d => new { d.Id, d.FileName })
            .ToListAsync();

        return documents.ToDictionary(
            d => d.Id.ToString(),
            d => d.FileName,
            StringComparer.OrdinalIgnoreCase
        );
    }

    private static List<SourceReferenceDto> NormalizeSources(
        IEnumerable<SourceReferenceDto> sources,
        IReadOnlyDictionary<string, string> docNameById
    )
    {
        var normalized = new List<SourceReferenceDto>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var source in sources)
        {
            var key = !string.IsNullOrWhiteSpace(source.DocumentId)
                ? $"doc:{source.DocumentId.Trim()}"
                : $"file:{source.FileName?.Trim() ?? ""}";

            if (!seen.Add(key))
                continue;

            var fileName = source.FileName?.Trim() ?? "";
            if (!string.IsNullOrWhiteSpace(source.DocumentId)
                && docNameById.TryGetValue(source.DocumentId.Trim(), out var mappedName)
                && !string.IsNullOrWhiteSpace(mappedName))
            {
                fileName = mappedName;
            }

            normalized.Add(new SourceReferenceDto
            {
                DocumentId = source.DocumentId,
                FileName = fileName,
                Snippet = source.Snippet
            });
        }

        return normalized;
    }
}
