using EduBoost.API.Features.LearningPaths.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.LearningPaths;

public interface ILearningPathsRepository
{
    Task<LearningPathDto> GetMyPathAsync(Guid userId);
    Task<LearningPathDto> RegenerateAsync(Guid userId);
    Task<LearningPathItemDto?> MarkCompleteAsync(Guid userId, Guid pathItemId);
}

public class LearningPathsRepository(AppDbContext db) : ILearningPathsRepository
{
    public async Task<LearningPathDto> GetMyPathAsync(Guid userId)
    {
        var items = await db.PersonalizedLearningPaths
            .Where(lp => lp.UserId == userId)
            .Include(lp => lp.Topic)
            .OrderBy(lp => lp.OrderIndex)
            .ToListAsync();

        return new LearningPathDto
        {
            Items = items.Select(MapToDto).ToList(),
            TotalItems = items.Count,
            CompletedItems = items.Count(i => i.IsCompleted),
            OverallProgress = items.Count > 0 ? (double)items.Count(i => i.IsCompleted) / items.Count * 100 : 0
        };
    }

    public async Task<LearningPathDto> RegenerateAsync(Guid userId)
    {
        // Remove existing path
        var existing = await db.PersonalizedLearningPaths
            .Where(lp => lp.UserId == userId)
            .ToListAsync();
        db.PersonalizedLearningPaths.RemoveRange(existing);

        // Get BKT states to determine priorities
        var bktStates = await db.BktStates
            .Where(b => b.UserId == userId)
            .Include(b => b.Topic)
            .ToListAsync();

        // Get all available topics
        var allTopics = await db.Topics.ToListAsync();

        // Generate new path: prioritize weak topics (low mastery), then unseen topics
        var pathItems = new List<PersonalizedLearningPath>();
        int order = 0;

        // Topics with BKT state, sorted by mastery (weakest first)
        foreach (var state in bktStates.OrderBy(b => b.MasteryProbability))
        {
            if (state.MasteryProbability >= 0.95) continue; // Skip mastered topics

            string difficulty;
            if (state.MasteryProbability < 0.3) difficulty = "easy";
            else if (state.MasteryProbability < 0.7) difficulty = "medium";
            else difficulty = "hard";

            pathItems.Add(new PersonalizedLearningPath
            {
                UserId = userId,
                TopicId = state.TopicId,
                RecommendedDifficulty = difficulty,
                PriorityScore = 1.0 - state.MasteryProbability,
                NextReviewDate = DateTime.UtcNow.AddDays(1),
                IsCompleted = false,
                OrderIndex = order++
            });
        }

        // Topics without BKT state (unseen)
        var seenTopicIds = bktStates.Select(b => b.TopicId).ToHashSet();
        foreach (var topic in allTopics.Where(t => !seenTopicIds.Contains(t.Id)))
        {
            pathItems.Add(new PersonalizedLearningPath
            {
                UserId = userId,
                TopicId = topic.Id,
                RecommendedDifficulty = "easy",
                PriorityScore = 0.5,
                IsCompleted = false,
                OrderIndex = order++
            });
        }

        db.PersonalizedLearningPaths.AddRange(pathItems);
        await db.SaveChangesAsync();

        return new LearningPathDto
        {
            Items = pathItems.Select(MapToDto).ToList(),
            TotalItems = pathItems.Count,
            CompletedItems = 0,
            OverallProgress = 0
        };
    }

    public async Task<LearningPathItemDto?> MarkCompleteAsync(Guid userId, Guid pathItemId)
    {
        var item = await db.PersonalizedLearningPaths
            .Include(lp => lp.Topic)
            .FirstOrDefaultAsync(lp => lp.Id == pathItemId && lp.UserId == userId);

        if (item == null) return null;

        item.IsCompleted = true;
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return MapToDto(item);
    }

    private static LearningPathItemDto MapToDto(PersonalizedLearningPath lp) => new()
    {
        Id = lp.Id.ToString(),
        TopicId = lp.TopicId.ToString(),
        TopicName = lp.Topic?.Name ?? "",
        RecommendedDifficulty = lp.RecommendedDifficulty,
        PriorityScore = lp.PriorityScore,
        NextReviewDate = lp.NextReviewDate?.ToString("yyyy-MM-dd"),
        IsCompleted = lp.IsCompleted,
        OrderIndex = lp.OrderIndex
    };
}
