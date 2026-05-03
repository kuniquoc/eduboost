using EduBoost.API.Features.Roadmap.Models;
using EduBoost.API.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Roadmap;

public interface IRoadmapRepository
{
    Task<RoadmapDto?> GetByClassIdAsync(Guid classId, Guid studentId);
    Task<RoadmapDto> GenerateAsync(Guid classId, Guid studentId, string entryTestResultId);
    Task<RoadmapStepDto?> UpdateStepAsync(Guid classId, string stepId, UpdateStepRequest request);
}

public class RoadmapRepository(AppDbContext db) : IRoadmapRepository
{
    public async Task<RoadmapDto?> GetByClassIdAsync(Guid classId, Guid studentId)
    {
        // Query topics for class and enrollment progress as roadmap steps
        var topics = await db.Topics
            .Where(t => t.ClassId == classId)
            .OrderBy(t => t.CreatedAt)
            .ToListAsync();

        var enrollment = await db.Enrollments
            .FirstOrDefaultAsync(e => e.ClassId == classId && e.StudentId == studentId);

        if (!topics.Any()) return null;

        // Build a simple roadmap from topics
        var steps = topics.Select((t, i) => new RoadmapStepDto
        {
            Id         = $"step-{t.Id}",
            TopicId    = t.Id.ToString(),
            TopicName  = t.Name,
            Status     = i == 0 ? "recommended" : "locked",
            Progress   = 0,
            Reason     = i == 0 ? "Bắt đầu từ chủ đề này" : null,
            OrderIndex = i + 1
        }).ToList();

        return new RoadmapDto
        {
            ClassId     = classId.ToString(),
            StudentId   = studentId.ToString(),
            GeneratedAt = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            Steps       = steps
        };
    }

    public async Task<RoadmapDto> GenerateAsync(Guid classId, Guid studentId, string entryTestResultId)
    {
        // AI placeholder: generate roadmap based on topics ordered by difficulty
        var topics = await db.Topics
            .Where(t => t.ClassId == classId)
            .OrderBy(t => t.Difficulty == "easy" ? 0 : t.Difficulty == "medium" ? 1 : 2)
            .ThenBy(t => t.CreatedAt)
            .ToListAsync();

        var steps = topics.Select((t, i) => new RoadmapStepDto
        {
            Id         = $"step-{Guid.NewGuid():N}",
            TopicId    = t.Id.ToString(),
            TopicName  = t.Name,
            Status     = i == 0 ? "recommended" : "locked",
            Progress   = 0,
            Reason     = i == 0 ? "AI đề xuất: bắt đầu từ chủ đề dễ nhất" : null,
            OrderIndex = i + 1
        }).ToList();

        return new RoadmapDto
        {
            ClassId     = classId.ToString(),
            StudentId   = studentId.ToString(),
            GeneratedAt = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            Steps       = steps
        };
    }

    public async Task<RoadmapStepDto?> UpdateStepAsync(Guid classId, string stepId, UpdateStepRequest request)
    {
        // Step IDs are virtual (computed from topic IDs) — return a stub update
        // In a full implementation this would persist to a LearningRoadmap table
        if (string.IsNullOrEmpty(stepId)) return null;

        // Placeholder: parse topicId from stepId pattern "step-{topicId}"
        var topicIdStr = stepId.Replace("step-", "");
        if (!Guid.TryParse(topicIdStr, out var topicId)) return null;

        var topic = await db.Topics.FindAsync(topicId);
        if (topic == null) return null;

        return new RoadmapStepDto
        {
            Id         = stepId,
            TopicId    = topic.Id.ToString(),
            TopicName  = topic.Name,
            Status     = request.Status ?? "in_progress",
            Progress   = request.Progress,
            OrderIndex = 0
        };
    }
}
