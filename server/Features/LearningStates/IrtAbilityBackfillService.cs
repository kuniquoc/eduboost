using System.Diagnostics;
using EduBoost.API.Common.Learning;
using EduBoost.API.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.LearningStates;

public interface IIrtAbilityBackfillService
{
    Task RunAsync(CancellationToken cancellationToken = default);
}

public sealed class IrtAbilityBackfillService(
    AppDbContext db,
    ILearningEvidenceService learningEvidence,
    ILogger<IrtAbilityBackfillService> logger) : IIrtAbilityBackfillService
{
    private const int BatchSize = 100;
    private const long AdvisoryLockKey = 4_549_525_466_842_029_122L;

    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        var usesPostgres = string.Equals(
            db.Database.ProviderName,
            "Npgsql.EntityFrameworkCore.PostgreSQL",
            StringComparison.Ordinal);

        if (usesPostgres)
        {
            await db.Database.OpenConnectionAsync(cancellationToken);
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_lock({AdvisoryLockKey})", cancellationToken);
        }

        try
        {
            await RunBackfillAsync(cancellationToken);
        }
        finally
        {
            if (usesPostgres)
            {
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"SELECT pg_advisory_unlock({AdvisoryLockKey})", CancellationToken.None);
                await db.Database.CloseConnectionAsync();
            }
        }
    }

    private async Task RunBackfillAsync(CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var skipped = await db.IrtAbilityStates.CountAsync(
            a => a.EstimatorVersion >= Rasch1PlEstimator.CurrentVersion, cancellationToken);
        var pending = await db.IrtAbilityStates.CountAsync(
            a => a.EstimatorVersion < Rasch1PlEstimator.CurrentVersion, cancellationToken);

        if (pending == 0)
        {
            logger.LogInformation(
                "IRT ability backfill is current at estimator version {Version}; skipped {Skipped} states.",
                Rasch1PlEstimator.CurrentVersion,
                skipped);
            return;
        }

        logger.LogInformation(
            "Starting IRT ability backfill for {Pending} states to estimator version {Version}.",
            pending,
            Rasch1PlEstimator.CurrentVersion);

        var recomputed = 0;
        var preserved = 0;

        while (true)
        {
            var states = await db.IrtAbilityStates
                .Where(a => a.EstimatorVersion < Rasch1PlEstimator.CurrentVersion)
                .OrderBy(a => a.Id)
                .Take(BatchSize)
                .ToListAsync(cancellationToken);

            if (states.Count == 0) break;

            foreach (var state in states)
            {
                var hasResponses = await db.IrtResponses.AnyAsync(
                    r => r.UserId == state.UserId && r.TopicId == state.TopicId,
                    cancellationToken);

                if (!hasResponses)
                {
                    state.EstimatorVersion = Rasch1PlEstimator.CurrentVersion;
                    preserved++;
                    continue;
                }

                var estimate = await learningEvidence.EstimateAbilityAsync(
                    state.UserId, state.TopicId, cancellationToken);
                state.Theta = estimate.Theta;
                state.StandardError = estimate.StandardError;
                state.ResponseCount = estimate.ResponseCount;
                state.EstimatorVersion = Rasch1PlEstimator.CurrentVersion;
                state.UpdatedAt = DateTime.UtcNow;
                recomputed++;
            }

            await db.SaveChangesAsync(cancellationToken);
            db.ChangeTracker.Clear();
        }

        stopwatch.Stop();
        logger.LogInformation(
            "Completed IRT ability backfill: recomputed {Recomputed}, preserved {Preserved}, skipped {Skipped} in {ElapsedMs} ms.",
            recomputed,
            preserved,
            skipped,
            stopwatch.ElapsedMilliseconds);
    }
}
