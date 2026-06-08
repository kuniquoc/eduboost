using System.Text.Json;
using EduBoost.API.Features.AiChat.Models;
using EduBoost.API.Features.Documents;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Services;
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

        // Save assistant response
        var assistantMessage = new ConversationMessage
        {
            UserId = userId,
            TopicId = request.TopicId,
            Role = "assistant",
            Content = agentResponse.Answer,
            SourceReferencesJson = agentResponse.Sources.Count > 0
                ? JsonSerializer.Serialize(agentResponse.Sources)
                : null
        };
        db.ConversationMessages.Add(assistantMessage);
        await db.SaveChangesAsync();

        return new AskResponse
        {
            Answer = agentResponse.Answer,
            Sources = agentResponse.Sources.Select(s => new SourceReferenceDto
            {
                DocumentId = s.DocumentId,
                FileName = s.FileName,
                Snippet = s.Snippet
            }).ToList(),
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

        return new ChatHistoryDto
        {
            Total = total,
            Messages = messages.Select(m => new ChatMessageDto
            {
                Id = m.Id.ToString(),
                Role = m.Role,
                Content = m.Content,
                Sources = string.IsNullOrEmpty(m.SourceReferencesJson)
                    ? []
                    : JsonSerializer.Deserialize<List<SourceReferenceDto>>(m.SourceReferencesJson) ?? [],
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
}
