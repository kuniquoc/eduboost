using EduBoost.API.Features.Roadmap.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Roadmap;

public interface IRoadmapRepository
{
    Task<RoadmapDto?> GetByClassIdAsync(Guid classId, Guid studentId);
    Task<RoadmapDto> GenerateAsync(Guid classId, Guid studentId, string entryTestResultId);
    Task<RoadmapStepDto?> UpdateStepAsync(Guid classId, Guid studentId, string stepId, UpdateStepRequest request);
    Task SyncAfterLearningAsync(Guid classId, Guid studentId, Guid topicId);
    Task EnsureClassTopicsSyncedAsync(Guid classId, Guid studentId);
}

public class RoadmapRepository(AppDbContext db) : IRoadmapRepository
{
    private const double MasteryCompleteThreshold = 0.95;
    private const double DefaultMastery = 0.3;

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
            return await GenerateAsync(classId, studentId, entryTestResultId: string.Empty);

        var pathTopicIds = paths.Select(p => p.TopicId).ToHashSet();
        if (topicIds.Any(id => !pathTopicIds.Contains(id)) || paths.Any(p => !topicIds.Contains(p.TopicId)))
        {
            await EnsureClassTopicsSyncedAsync(classId, studentId);
            paths = await db.PersonalizedLearningPaths
                .Where(p => p.UserId == studentId && topicIds.Contains(p.TopicId))
                .OrderBy(p => p.OrderIndex)
                .ThenByDescending(p => p.PriorityScore)
                .ToListAsync();
        }

        var topicMap = topics.ToDictionary(t => t.Id);
        var steps = BuildSteps(paths, topicMap);

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
        var bktByTopic = await db.BktStates
            .Where(b => b.UserId == studentId && topicIds.Contains(b.TopicId))
            .ToDictionaryAsync(b => b.TopicId, b => b.MasteryProbability);

        var existing = await db.PersonalizedLearningPaths
            .Where(p => p.UserId == studentId && topicIds.Contains(p.TopicId))
            .ToListAsync();

        foreach (var stale in existing.Where(e => !topicIds.Contains(e.TopicId)))
            db.PersonalizedLearningPaths.Remove(stale);

        for (var i = 0; i < topics.Count; i++)
        {
            var topic = topics[i];
            var current = existing.FirstOrDefault(p => p.TopicId == topic.Id);
            var mastery = bktByTopic.GetValueOrDefault(topic.Id, DefaultMastery);
            var priority = bktByTopic.ContainsKey(topic.Id)
                ? Math.Max(0.0, 1.0 - mastery)
                : Math.Max(0.0, 1.0 - (i * 0.1));
            var difficulty = bktByTopic.ContainsKey(topic.Id)
                ? MapDifficultyFromMastery(mastery)
                : topic.Difficulty;

            if (current == null)
            {
                db.PersonalizedLearningPaths.Add(new PersonalizedLearningPath
                {
                    Id = Guid.NewGuid(),
                    UserId = studentId,
                    TopicId = topic.Id,
                    RecommendedDifficulty = difficulty,
                    PriorityScore = priority,
                    IsCompleted = mastery >= MasteryCompleteThreshold,
                    OrderIndex = i + 1,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }
            else
            {
                current.RecommendedDifficulty = difficulty;
                current.PriorityScore = priority;
                current.OrderIndex = i + 1;
                if (mastery >= MasteryCompleteThreshold)
                    current.IsCompleted = true;
                current.UpdatedAt = DateTime.UtcNow;
            }
        }

        await db.SaveChangesAsync();

        var refreshedPaths = await db.PersonalizedLearningPaths
            .Where(p => p.UserId == studentId && topicIds.Contains(p.TopicId))
            .OrderBy(p => p.OrderIndex)
            .ToListAsync();

        var topicMap = topics.ToDictionary(t => t.Id);
        var steps = BuildSteps(refreshedPaths, topicMap);

        return new RoadmapDto
        {
            ClassId = classId.ToString(),
            StudentId = studentId.ToString(),
            GeneratedAt = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            Steps = steps
        };
    }

    public async Task SyncAfterLearningAsync(Guid classId, Guid studentId, Guid topicId)
    {
        var path = await db.PersonalizedLearningPaths
            .Include(p => p.Topic)
            .FirstOrDefaultAsync(p =>
                p.UserId == studentId &&
                p.TopicId == topicId &&
                p.Topic.ClassId == classId);

        if (path == null) return;

        var bkt = await db.BktStates
            .FirstOrDefaultAsync(b => b.UserId == studentId && b.TopicId == topicId);

        var mastery = bkt?.MasteryProbability ?? DefaultMastery;

        if (mastery >= MasteryCompleteThreshold)
            path.IsCompleted = true;

        path.RecommendedDifficulty = MapDifficultyFromMastery(mastery);
        path.PriorityScore = Math.Max(0.0, 1.0 - mastery);
        path.UpdatedAt = DateTime.UtcNow;

        var topicIds = await db.Topics
            .Where(t => t.ClassId == classId)
            .Select(t => t.Id)
            .ToListAsync();

        var classPaths = await db.PersonalizedLearningPaths
            .Where(p => p.UserId == studentId && topicIds.Contains(p.TopicId))
            .ToListAsync();

        var bktByTopic = await db.BktStates
            .Where(b => b.UserId == studentId && topicIds.Contains(b.TopicId))
            .ToDictionaryAsync(b => b.TopicId, b => b.MasteryProbability);

        var completedMaxOrder = classPaths
            .Where(p => p.IsCompleted)
            .Select(p => (int?)p.OrderIndex)
            .DefaultIfEmpty(0)
            .Max() ?? 0;

        var incomplete = classPaths
            .Where(p => !p.IsCompleted)
            .OrderBy(p => bktByTopic.GetValueOrDefault(p.TopicId, DefaultMastery))
            .ThenBy(p => p.OrderIndex)
            .ToList();

        var nextOrder = completedMaxOrder + 1;
        foreach (var item in incomplete)
            item.OrderIndex = nextOrder++;

        await db.SaveChangesAsync();
    }

    public async Task EnsureClassTopicsSyncedAsync(Guid classId, Guid studentId)
    {
        var topics = await db.Topics
            .Where(t => t.ClassId == classId)
            .OrderBy(t => t.CreatedAt)
            .ToListAsync();

        if (!topics.Any()) return;

        var topicIds = topics.Select(t => t.Id).ToHashSet();
        var existing = await db.PersonalizedLearningPaths
            .Where(p => p.UserId == studentId && topicIds.Contains(p.TopicId))
            .ToListAsync();

        foreach (var stale in existing.Where(e => !topicIds.Contains(e.TopicId)))
            db.PersonalizedLearningPaths.Remove(stale);

        var existingTopicIds = existing.Select(p => p.TopicId).ToHashSet();
        var missingTopics = topics.Where(t => !existingTopicIds.Contains(t.Id)).ToList();

        if (missingTopics.Count == 0)
        {
            if (existing.Any(e => !topicIds.Contains(e.TopicId)))
                await db.SaveChangesAsync();
            return;
        }

        var maxOrder = existing.Count > 0 ? existing.Max(p => p.OrderIndex) : 0;
        var bktByTopic = await db.BktStates
            .Where(b => b.UserId == studentId && topicIds.Contains(b.TopicId))
            .ToDictionaryAsync(b => b.TopicId, b => b.MasteryProbability);

        foreach (var topic in missingTopics)
        {
            var mastery = bktByTopic.GetValueOrDefault(topic.Id, DefaultMastery);
            maxOrder++;
            db.PersonalizedLearningPaths.Add(new PersonalizedLearningPath
            {
                Id = Guid.NewGuid(),
                UserId = studentId,
                TopicId = topic.Id,
                RecommendedDifficulty = MapDifficultyFromMastery(mastery),
                PriorityScore = Math.Max(0.0, 1.0 - mastery),
                IsCompleted = mastery >= MasteryCompleteThreshold,
                OrderIndex = maxOrder,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync();
    }

    public async Task<RoadmapStepDto?> UpdateStepAsync(Guid classId, Guid studentId, string stepId, UpdateStepRequest request)
    {
        if (string.IsNullOrEmpty(stepId)) return null;

        PersonalizedLearningPath? path = null;

        if (Guid.TryParse(stepId, out var pathId))
        {
            path = await db.PersonalizedLearningPaths
                .Include(p => p.Topic)
                .FirstOrDefaultAsync(p => p.Id == pathId && p.UserId == studentId && p.Topic.ClassId == classId);
        }
        else
        {
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

    private static string MapDifficultyFromMastery(double mastery) =>
        mastery < 0.3 ? "easy" : mastery < 0.7 ? "medium" : "hard";

    private static List<RoadmapStepDto> BuildSteps(
        List<PersonalizedLearningPath> paths,
        Dictionary<Guid, Topic> topicMap)
    {
        var firstIncompleteOrder = paths
            .Where(p => !p.IsCompleted)
            .OrderBy(p => p.OrderIndex)
            .Select(p => (int?)p.OrderIndex)
            .FirstOrDefault();

        return paths
            .Where(p => topicMap.ContainsKey(p.TopicId))
            .Select(p =>
            {
                var status = p.IsCompleted
                    ? "completed"
                    : firstIncompleteOrder.HasValue && p.OrderIndex == firstIncompleteOrder.Value
                        ? "recommended"
                        : "locked";

                string? reason = null;
                if (status == "recommended")
                {
                    reason = p.PriorityScore >= 0.7
                        ? "Ưu tiên ôn vì mức thành thạo còn thấp"
                        : "Bước học tiếp theo theo lộ trình cá nhân";
                }

                return new RoadmapStepDto
                {
                    Id = p.Id.ToString(),
                    TopicId = p.TopicId.ToString(),
                    TopicName = topicMap[p.TopicId].Name,
                    Status = status,
                    Progress = p.IsCompleted ? 100 : 0,
                    Reason = reason,
                    OrderIndex = p.OrderIndex
                };
            })
            .OrderBy(s => s.OrderIndex)
            .ToList();
    }

    private class PlacementWeakness
    {
        public string TopicId { get; set; } = "";
    }
}
