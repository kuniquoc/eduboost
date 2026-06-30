using EduBoost.API.Features.Roadmap.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
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
    private const double DefaultTheta = 0.0;

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

        var bktByTopic = await db.BktStates
            .Where(b => b.UserId == studentId && topicIds.Contains(b.TopicId))
            .ToDictionaryAsync(b => b.TopicId, b => b);
        var abilityByTopic = await db.IrtAbilityStates
            .Where(a => a.UserId == studentId && topicIds.Contains(a.TopicId))
            .ToDictionaryAsync(a => a.TopicId, a => a);

        var dueByTopic = topicIds.ToDictionary(id => id, _ => 0);
        var topicMap = topics.ToDictionary(t => t.Id);
        var statesByTopic = topicIds
            .Where(id => bktByTopic.ContainsKey(id) || abilityByTopic.ContainsKey(id))
            .ToDictionary(
                id => id,
                id => (
                    bktByTopic.GetValueOrDefault(id)?.MasteryProbability ?? DefaultMastery,
                    abilityByTopic.GetValueOrDefault(id)?.Theta ?? DefaultTheta));
        var steps = BuildSteps(paths, topicMap, statesByTopic, dueByTopic);

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
            .ToDictionaryAsync(b => b.TopicId, b => b);
        var abilityByTopic = await db.IrtAbilityStates
            .Where(a => a.UserId == studentId && topicIds.Contains(a.TopicId))
            .ToDictionaryAsync(a => a.TopicId, a => a);

        var dueByTopic = topicIds.ToDictionary(id => id, _ => 0);

        var existing = await db.PersonalizedLearningPaths
            .Where(p => p.UserId == studentId && topicIds.Contains(p.TopicId))
            .ToListAsync();

        foreach (var stale in existing.Where(e => !topicIds.Contains(e.TopicId)))
            db.PersonalizedLearningPaths.Remove(stale);

        for (var i = 0; i < topics.Count; i++)
        {
            var topic = topics[i];
            var current = existing.FirstOrDefault(p => p.TopicId == topic.Id);
            var state = bktByTopic.GetValueOrDefault(topic.Id);
            var mastery = state?.MasteryProbability ?? DefaultMastery;
            var theta = abilityByTopic.GetValueOrDefault(topic.Id)?.Theta ?? DefaultTheta;
            var topicBeta = IrtScale.PriorFromBand(topic.Difficulty);
            var knowledgeGap = Math.Max(0.0, 1.0 - mastery);
            var challengeFit = 1.0 - Math.Min(1.0, Math.Abs(theta - topicBeta) / 6.0);
            var priority = Math.Clamp((knowledgeGap * 0.70) + (challengeFit * 0.30), 0.0, 1.0);
            var difficulty = MapDifficultyFromMastery(mastery);

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
        var statesByTopic = topicIds
            .Where(id => bktByTopic.ContainsKey(id) || abilityByTopic.ContainsKey(id))
            .ToDictionary(
                id => id,
                id => (
                    bktByTopic.GetValueOrDefault(id)?.MasteryProbability ?? DefaultMastery,
                    abilityByTopic.GetValueOrDefault(id)?.Theta ?? DefaultTheta));
        var steps = BuildSteps(refreshedPaths, topicMap, statesByTopic, dueByTopic);

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
        var topicDifficultyById = await db.Topics
            .Where(t => topicIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Difficulty);

        var classPaths = await db.PersonalizedLearningPaths
            .Where(p => p.UserId == studentId && topicIds.Contains(p.TopicId))
            .ToListAsync();

        var bktByTopic = await db.BktStates
            .Where(b => b.UserId == studentId && topicIds.Contains(b.TopicId))
            .ToDictionaryAsync(b => b.TopicId, b => b);
        var abilityByTopic = await db.IrtAbilityStates
            .Where(a => a.UserId == studentId && topicIds.Contains(a.TopicId))
            .ToDictionaryAsync(a => a.TopicId, a => a);

        var dueByTopic = topicIds.ToDictionary(id => id, _ => 0);

        var completedMaxOrder = classPaths
            .Where(p => p.IsCompleted)
            .Select(p => (int?)p.OrderIndex)
            .DefaultIfEmpty(0)
            .Max() ?? 0;

        var incomplete = classPaths
            .Where(p => !p.IsCompleted)
            .OrderByDescending(p =>
            {
                var bkt = bktByTopic.GetValueOrDefault(p.TopicId);
                var mastery = bkt?.MasteryProbability ?? DefaultMastery;
                var theta = abilityByTopic.GetValueOrDefault(p.TopicId)?.Theta ?? DefaultTheta;
                var topicBeta = IrtScale.PriorFromBand(topicDifficultyById.GetValueOrDefault(p.TopicId));
                var knowledgeGap = Math.Max(0.0, 1.0 - mastery);
                var challengeFit = 1.0 - Math.Min(1.0, Math.Abs(theta - topicBeta) / 6.0);
                return (knowledgeGap * 0.70) + (challengeFit * 0.30);
            })
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
            .ToDictionaryAsync(b => b.TopicId, b => b);

        foreach (var topic in missingTopics)
        {
            var mastery = bktByTopic.GetValueOrDefault(topic.Id)?.MasteryProbability ?? DefaultMastery;
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
        Dictionary<Guid, Topic> topicMap,
        Dictionary<Guid, (double Mastery, double Theta)>? statesByTopic = null,
        Dictionary<Guid, int>? dueByTopic = null)
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
                        : "in_progress";

                string? reason = null;
                if (status == "recommended")
                {
                    var state = statesByTopic != null && statesByTopic.TryGetValue(p.TopicId, out var tuple)
                        ? tuple
                        : (Mastery: DefaultMastery, Theta: DefaultTheta);
                    var beta = IrtScale.PriorFromBand(topicMap[p.TopicId].Difficulty);
                    var due = dueByTopic?.GetValueOrDefault(p.TopicId) ?? 0;
                    reason = $"mastery={state.Mastery:F2}, theta={state.Theta:F2}, beta={beta:F2}, due={due}";
                }

                (double Mastery, double Theta) dtoTuple = default;
                var hasStateForDto = statesByTopic != null && statesByTopic.TryGetValue(p.TopicId, out dtoTuple);
                var stateForDto = hasStateForDto
                    ? dtoTuple
                    : (Mastery: 0.0, Theta: DefaultTheta);
                var dtoBeta = IrtScale.PriorFromBand(topicMap[p.TopicId].Difficulty);
                var dtoDue = dueByTopic?.GetValueOrDefault(p.TopicId) ?? 0;
                var progress = p.IsCompleted
                    ? 100
                    : hasStateForDto
                        ? (int)Math.Clamp(Math.Round(stateForDto.Mastery * 100), 0, 99)
                        : 0;

                return new RoadmapStepDto
                {
                    Id = p.Id.ToString(),
                    TopicId = p.TopicId.ToString(),
                    TopicName = topicMap[p.TopicId].Name,
                    Status = status,
                    Progress = progress,
                    Reason = reason,
                    Mastery = stateForDto.Mastery,
                    Theta = stateForDto.Theta,
                    TopicBeta = dtoBeta,
                    DueCount = dtoDue,
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
