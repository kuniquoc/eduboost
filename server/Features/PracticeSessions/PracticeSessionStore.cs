using System.Text.Json;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.PracticeSessions;

internal sealed class PracticeSessionStore(AppDbContext db)
{
    private static readonly TimeSpan SessionTtl = TimeSpan.FromHours(2);

    public DateTime NewExpiry() => DateTime.UtcNow.Add(SessionTtl);

    public async Task<PracticeActiveSession> LoadAsync(Guid userId, string sessionId)
    {
        if (!Guid.TryParse(sessionId, out var id))
            throw new InvalidOperationException("Session not found");

        var session = await db.PracticeActiveSessions.FirstOrDefaultAsync(candidate =>
            candidate.Id == id &&
            candidate.UserId == userId &&
            candidate.ExpiresAt > DateTime.UtcNow);
        return session ?? throw new InvalidOperationException("Session not found");
    }

    public PracticeSessionState Deserialize(PracticeActiveSession session) =>
        JsonSerializer.Deserialize<PracticeSessionState>(session.StateJson)
        ?? throw new InvalidOperationException("Invalid session state");

    public async Task SaveAsync(PracticeActiveSession session, PracticeSessionState state)
    {
        // Mỗi thao tác hợp lệ gia hạn phiên để người học không mất tiến độ giữa chừng.
        session.StateJson = JsonSerializer.Serialize(state);
        session.ExpiresAt = NewExpiry();
        await db.SaveChangesAsync();
    }
}
