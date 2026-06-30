using EduBoost.API.Features.LearningStates.Models;
using EduBoost.API.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.LearningStates;

public interface ILearningStatesRepository
{
    Task<BktStateDto?> GetStateByTopicAsync(Guid userId, Guid topicId);
}

public sealed class LearningStatesRepository(AppDbContext db) : ILearningStatesRepository
{
    public async Task<BktStateDto?> GetStateByTopicAsync(Guid userId, Guid topicId)
    {
        var topic = await db.Topics.FindAsync(topicId);
        if (topic == null) return null;
        var bkt = await db.BktStates.FirstOrDefaultAsync(b => b.UserId == userId && b.TopicId == topicId);
        var ability = await db.IrtAbilityStates.FirstOrDefaultAsync(a => a.UserId == userId && a.TopicId == topicId);
        if (bkt == null && ability == null) return null;

        return new BktStateDto
        {
            TopicId = topicId.ToString(),
            TopicName = topic.Name,
            MasteryProbability = bkt?.MasteryProbability ?? Common.Learning.BktCalculator.InitialMastery,
            IrtTheta = ability?.Theta ?? 0.0,
            IrtThetaStandardError = ability?.StandardError ?? 1.0,
            IrtResponseCount = ability?.ResponseCount ?? 0,
            UpdatedAt = (ability?.UpdatedAt ?? bkt?.UpdatedAt ?? DateTime.UtcNow).ToString("yyyy-MM-dd HH:mm:ss")
        };
    }
}
