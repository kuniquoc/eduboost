using EduBoost.API.Common.Learning;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.LearningStates;

public readonly record struct LearningEvidenceResult(
    double MasteryProbability,
    double Theta,
    double ThetaStandardError,
    int IrtResponseCount,
    bool WasRecorded);

public interface ILearningEvidenceService
{
    Task<LearningEvidenceResult> RecordAsync(
        Guid userId,
        Guid topicId,
        Guid questionId,
        bool isCorrect,
        string source,
        Guid attemptId,
        int sequence,
        CancellationToken cancellationToken = default);

    Task<LearningEvidenceResult> RecordAsync(
        Guid userId,
        Guid topicId,
        Question question,
        bool isCorrect,
        string source,
        Guid attemptId,
        int sequence,
        CancellationToken cancellationToken = default);

    Task<IrtAbilityState?> GetAbilityAsync(Guid userId, Guid topicId, CancellationToken cancellationToken = default);
    Task<RaschEstimate> EstimateAbilityAsync(Guid userId, Guid topicId, CancellationToken cancellationToken = default);
    Task SeedPlacementBktAsync(Guid userId, Guid topicId, IReadOnlyList<bool> answers, CancellationToken cancellationToken = default);
    Task<IrtAbilityState> RecomputeAbilityAsync(Guid userId, Guid topicId, CancellationToken cancellationToken = default);
}

public sealed class LearningEvidenceService(AppDbContext db) : ILearningEvidenceService
{
    private static readonly TimeSpan AbilityWindow = TimeSpan.FromDays(180);
    private const int MaxAbilityItems = 50;

    public async Task<LearningEvidenceResult> RecordAsync(
        Guid userId,
        Guid topicId,
        Question question,
        bool isCorrect,
        string source,
        Guid attemptId,
        int sequence,
        CancellationToken cancellationToken = default)
    {
        var duplicate = await db.IrtResponses.AnyAsync(r =>
            r.UserId == userId && r.Source == source && r.AttemptId == attemptId && r.Sequence == sequence,
            cancellationToken);
        if (duplicate)
        {
            var currentBkt = await db.BktStates.FirstOrDefaultAsync(
                b => b.UserId == userId && b.TopicId == topicId, cancellationToken);
            var currentAbility = await GetAbilityAsync(userId, topicId, cancellationToken)
                ?? new IrtAbilityState { UserId = userId, TopicId = topicId };
            return new LearningEvidenceResult(
                currentBkt?.MasteryProbability ?? BktCalculator.InitialMastery,
                currentAbility.Theta,
                currentAbility.StandardError,
                currentAbility.ResponseCount,
                false);
        }

        var item = question.IrtItem;
        if (item == null && question.IrtItemId != Guid.Empty)
            item = await db.IrtItems.FindAsync([question.IrtItemId], cancellationToken);
        if (item == null || question.IrtItemId == Guid.Empty)
            throw new InvalidOperationException("Question does not have an IRT item");

        db.IrtResponses.Add(new IrtResponse
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TopicId = topicId,
            IrtItemId = question.IrtItemId,
            QuestionId = question.Id,
            IsCorrect = isCorrect,
            BetaAtResponse = item.Beta,
            Source = source,
            AttemptId = attemptId,
            Sequence = sequence,
            CreatedAt = DateTime.UtcNow
        });

        var bkt = await db.BktStates.FirstOrDefaultAsync(
            b => b.UserId == userId && b.TopicId == topicId, cancellationToken);
        if (bkt == null)
        {
            bkt = new BktState { Id = Guid.NewGuid(), UserId = userId, TopicId = topicId };
            db.BktStates.Add(bkt);
        }
        bkt.MasteryProbability = BktCalculator.Update(bkt.MasteryProbability, isCorrect);
        bkt.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        var ability = await RecomputeAbilityAsync(userId, topicId, cancellationToken);
        return new LearningEvidenceResult(
            bkt.MasteryProbability,
            ability.Theta,
            ability.StandardError,
            ability.ResponseCount,
            true);
    }

    public Task<IrtAbilityState?> GetAbilityAsync(Guid userId, Guid topicId, CancellationToken cancellationToken = default) =>
        db.IrtAbilityStates.FirstOrDefaultAsync(a => a.UserId == userId && a.TopicId == topicId, cancellationToken);

    public async Task<RaschEstimate> EstimateAbilityAsync(
        Guid userId,
        Guid topicId,
        CancellationToken cancellationToken = default)
    {
        var cutoff = DateTime.UtcNow.Subtract(AbilityWindow);
        var responses = await db.IrtResponses
            .Where(r => r.UserId == userId && r.TopicId == topicId && r.CreatedAt >= cutoff)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        var observations = responses
            .GroupBy(r => r.IrtItemId)
            .Select(g => g.First())
            .Take(MaxAbilityItems)
            .Select(r => new RaschObservation(r.BetaAtResponse, r.IsCorrect))
            .ToList();
        return Rasch1PlEstimator.Estimate(observations);
    }

    public async Task<IrtAbilityState> RecomputeAbilityAsync(Guid userId, Guid topicId, CancellationToken cancellationToken = default)
    {
        var estimate = await EstimateAbilityAsync(userId, topicId, cancellationToken);

        var ability = await db.IrtAbilityStates.FirstOrDefaultAsync(
            a => a.UserId == userId && a.TopicId == topicId, cancellationToken);
        if (ability == null)
        {
            ability = new IrtAbilityState
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TopicId = topicId
            };
            db.IrtAbilityStates.Add(ability);
        }
        ability.Theta = estimate.Theta;
        ability.StandardError = estimate.StandardError;
        ability.ResponseCount = estimate.ResponseCount;
        ability.EstimatorVersion = Rasch1PlEstimator.CurrentVersion;
        ability.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return ability;
    }

    public async Task SeedPlacementBktAsync(
        Guid userId,
        Guid topicId,
        IReadOnlyList<bool> answers,
        CancellationToken cancellationToken = default)
    {
        if (answers.Count == 0) return;
        var hasLearningEvidence = await db.IrtResponses.AnyAsync(
            r => r.UserId == userId && r.TopicId == topicId, cancellationToken);
        if (hasLearningEvidence) return;

        var bkt = await db.BktStates.FirstOrDefaultAsync(
            b => b.UserId == userId && b.TopicId == topicId, cancellationToken);
        if (bkt != null) return;

        var mastery = BktCalculator.InitialMastery;
        foreach (var answer in answers)
            mastery = BktCalculator.Update(mastery, answer, transition: 0.0);

        db.BktStates.Add(new BktState
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TopicId = topicId,
            MasteryProbability = mastery,
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<LearningEvidenceResult> RecordAsync(
        Guid userId,
        Guid topicId,
        Guid questionId,
        bool isCorrect,
        string source,
        Guid attemptId,
        int sequence,
        CancellationToken cancellationToken = default)
    {
        var question = await db.Questions.Include(q => q.IrtItem)
            .FirstOrDefaultAsync(q => q.Id == questionId, cancellationToken)
            ?? throw new InvalidOperationException("Question not found");
        return await RecordAsync(userId, topicId, question, isCorrect, source, attemptId, sequence, cancellationToken);
    }
}
