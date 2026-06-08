using EduBoost.API.Features.Roadmap.Models;
using EduBoost.API.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Roadmap;

public interface IRoadmapRepository
{
    Task<RoadmapDto?> GetByClassIdAsync(Guid classId, Guid studentId);
    Task<RoadmapDto> GenerateAsync(Guid classId, Guid studentId, string entryTestResultId);
    Task<RoadmapStepDto?> UpdateStepAsync(Guid classId, Guid studentId, string stepId, UpdateStepRequest request);
}

public class RoadmapRepository(AppDbContext db) : IRoadmapRepository
{
    public async Task<RoadmapDto?> GetByClassIdAsync(Guid classId, Guid studentId)
    {
        var topics = await db.Topics
            .Where(t => t.ClassId == classId)
            .OrderBy(t => t.CreatedAt)
            .ToListAsync();

        if (!topics.Any()) return null;

        var topicIds = topics.Select(t => t.Id).ToHashSet();
        var paths = await db.PersonalizedLearningPaths
            .Where(p => p.UserId == studentId && topicIds.Contains(p.TopicId))
            .OrderBy(p => p.OrderIndex)
            .ThenByDescending(p => p.PriorityScore)
            .ToListAsync();

        if (!paths.Any())
        {
            return await GenerateAsync(classId, studentId, entryTestResultId: string.Empty);
        }

        var topicMap = topics.ToDictionary(t => t.Id);
        var firstIncompleteOrder = paths
            .Where(p => !p.IsCompleted)
            .OrderBy(p => p.OrderIndex)
            .Select(p => (int?)p.OrderIndex)
            .FirstOrDefault();

        var steps = paths
            .Where(p => topicMap.ContainsKey(p.TopicId))
            .Select(p =>
            {
                var status = p.IsCompleted
                    ? "completed"
                    : firstIncompleteOrder.HasValue && p.OrderIndex == firstIncompleteOrder.Value
                        ? "recommended"
                        : "locked";

                return new RoadmapStepDto
                {
                    Id = p.Id.ToString(),
                    TopicId = p.TopicId.ToString(),
                    TopicName = topicMap[p.TopicId].Name,
                    Status = status,
                    Progress = p.IsCompleted ? 100 : 0,
                    Reason = status == "recommended" ? "Bước học tiếp theo theo lộ trình cá nhân" : null,
                    OrderIndex = p.OrderIndex
                };
            })
            .OrderBy(s => s.OrderIndex)
            .ToList();

        return new RoadmapDto
        {
            ClassId = classId.ToString(),
            StudentId = studentId.ToString(),
            GeneratedAt = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            Steps = steps
        };
    }

    public async Task<RoadmapDto> GenerateAsync(Guid classId, Guid studentId, string entryTestResultId)
    {
        var weakTopicIds = new HashSet<Guid>();
        if (Guid.TryParse(entryTestResultId, out var resultId))
        {
            var placement = await db.PlacementTestResults.FindAsync(resultId);
            if (placement?.WeaknessesJson != null)
            {
                try
                {
                    var weaknesses = System.Text.Json.JsonSerializer.Deserialize<List<PlacementWeakness>>(placement.WeaknessesJson) ?? [];
                    foreach (var w in weaknesses)
                        if (Guid.TryParse(w.TopicId, out var tid)) weakTopicIds.Add(tid);
                }
                catch { /* ignore malformed json */ }
            }
        }

        var topics = await db.Topics
            .Where(t => t.ClassId == classId)
            .OrderBy(t => weakTopicIds.Contains(t.Id) ? 0 : 1)
            .ThenBy(t => t.Difficulty == "easy" ? 0 : t.Difficulty == "medium" ? 1 : 2)
            .ThenBy(t => t.CreatedAt)
            .ToListAsync();

        var topicIds = topics.Select(t => t.Id).ToHashSet();
        var existing = await db.PersonalizedLearningPaths
            .Where(p => p.UserId == studentId && topicIds.Contains(p.TopicId))
            .ToListAsync();

        foreach (var stale in existing.Where(e => !topicIds.Contains(e.TopicId)))
        {
            db.PersonalizedLearningPaths.Remove(stale);
        }

        for (var i = 0; i < topics.Count; i++)
        {
            var topic = topics[i];
            var current = existing.FirstOrDefault(p => p.TopicId == topic.Id);
            var priority = Math.Max(0.0, 1.0 - (i * 0.1));

            if (current == null)
            {
                db.PersonalizedLearningPaths.Add(new Infrastructure.Entities.PersonalizedLearningPath
                {
                    Id = Guid.NewGuid(),
                    UserId = studentId,
                    TopicId = topic.Id,
                    RecommendedDifficulty = topic.Difficulty,
                    PriorityScore = priority,
                    IsCompleted = false,
                    OrderIndex = i + 1,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }
            else
            {
                current.RecommendedDifficulty = topic.Difficulty;
                current.PriorityScore = priority;
                current.OrderIndex = i + 1;
                current.UpdatedAt = DateTime.UtcNow;
            }
        }

        await db.SaveChangesAsync();

        var refreshedPaths = await db.PersonalizedLearningPaths
            .Where(p => p.UserId == studentId && topicIds.Contains(p.TopicId))
            .OrderBy(p => p.OrderIndex)
            .ToListAsync();

        var firstIncompleteOrder = refreshedPaths
            .Where(p => !p.IsCompleted)
            .OrderBy(p => p.OrderIndex)
            .Select(p => (int?)p.OrderIndex)
            .FirstOrDefault();

        var steps = refreshedPaths.Select(p => new RoadmapStepDto
        {
            Id = p.Id.ToString(),
            TopicId = p.TopicId.ToString(),
            TopicName = topics.First(t => t.Id == p.TopicId).Name,
            Status = p.IsCompleted
                ? "completed"
                : firstIncompleteOrder.HasValue && p.OrderIndex == firstIncompleteOrder.Value
                    ? "recommended"
                    : "locked",
            Progress = p.IsCompleted ? 100 : 0,
            Reason = firstIncompleteOrder.HasValue && p.OrderIndex == firstIncompleteOrder.Value
                ? "Lộ trình gợi ý dựa trên độ khó và tiến độ học"
                : null,
            OrderIndex = p.OrderIndex
        }).ToList();

        return new RoadmapDto
        {
            ClassId = classId.ToString(),
            StudentId = studentId.ToString(),
            GeneratedAt = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            Steps = steps
        };
    }

    public async Task<RoadmapStepDto?> UpdateStepAsync(Guid classId, Guid studentId, string stepId, UpdateStepRequest request)
    {
        if (string.IsNullOrEmpty(stepId)) return null;

        Infrastructure.Entities.PersonalizedLearningPath? path = null;

        // New format: stepId is PersonalizedLearningPath.Id
        if (Guid.TryParse(stepId, out var pathId))
        {
            path = await db.PersonalizedLearningPaths
                .Include(p => p.Topic)
                .FirstOrDefaultAsync(p => p.Id == pathId && p.UserId == studentId && p.Topic.ClassId == classId);
        }
        else
        {
            // Backward compatibility: legacy step-{topicId}
            var legacyTopic = stepId.Replace("step-", "");
            if (!Guid.TryParse(legacyTopic, out var topicId)) return null;

            path = await db.PersonalizedLearningPaths
                .Include(p => p.Topic)
                .Where(p => p.UserId == studentId && p.TopicId == topicId && p.Topic.ClassId == classId)
                .OrderByDescending(p => p.UpdatedAt)
                .FirstOrDefaultAsync();
        }

        if (path == null) return null;

        var normalizedStatus = (request.Status ?? string.Empty).Trim().ToLowerInvariant();
        var isCompleted = normalizedStatus == "completed" || request.Progress >= 100;
        path.IsCompleted = isCompleted;
        path.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return new RoadmapStepDto
        {
            Id = path.Id.ToString(),
            TopicId = path.TopicId.ToString(),
            TopicName = path.Topic.Name,
            Status = isCompleted
                ? "completed"
                : string.IsNullOrWhiteSpace(request.Status)
                    ? "in_progress"
                    : request.Status,
            Progress = isCompleted ? 100 : Math.Clamp(request.Progress, 0, 99),
            OrderIndex = path.OrderIndex
        };
    }

    private class PlacementWeakness
    {
        public string TopicId { get; set; } = "";
    }
}
