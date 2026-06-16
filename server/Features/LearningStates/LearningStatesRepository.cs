using EduBoost.API.Features.LearningStates.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.LearningStates;

public interface ILearningStatesRepository
{
    Task<List<BktStateDto>> GetAllStatesAsync(Guid userId);
    Task<BktStateDto?> GetStateByTopicAsync(Guid userId, Guid topicId);
    Task<UpdateBktResponse> UpdateAfterAnswerAsync(Guid userId, UpdateBktRequest request);
    Task<ReviewScheduleDto> GetReviewScheduleAsync(Guid userId);
    Task<List<Guid>> GetDueQuestionIdsAsync(Guid userId, IEnumerable<Guid>? questionIds = null);
}

public class LearningStatesRepository(AppDbContext db, ISpacedRepetitionService spacedRepetition) : ILearningStatesRepository
{
    public async Task<List<BktStateDto>> GetAllStatesAsync(Guid userId)
    {
        var states = await db.BktStates
            .Where(b => b.UserId == userId)
            .Include(b => b.Topic)
            .OrderByDescending(b => b.UpdatedAt)
            .ToListAsync();

        return states.Select(MapToDto).ToList();
    }

    public async Task<BktStateDto?> GetStateByTopicAsync(Guid userId, Guid topicId)
    {
        var state = await db.BktStates
            .Include(b => b.Topic)
            .FirstOrDefaultAsync(b => b.UserId == userId && b.TopicId == topicId);

        return state == null ? null : MapToDto(state);
    }

    public async Task<UpdateBktResponse> UpdateAfterAnswerAsync(Guid userId, UpdateBktRequest request)
    {
        var state = await db.BktStates
            .Include(b => b.Topic)
            .FirstOrDefaultAsync(b => b.UserId == userId && b.TopicId == request.TopicId);

        if (state == null)
        {
            var topic = await db.Topics.FindAsync(request.TopicId);
            state = new BktState
            {
                UserId = userId,
                TopicId = request.TopicId,
            };
            db.BktStates.Add(state);
            state.Topic = topic!;
        }

        // BKT + IRT Update
        var thetaBefore = state.IrtTheta;
        var beta = DifficultyIndex.Clamp(request.QuestionDifficultyIndex ?? DifficultyIndex.FromDifficultyLabel(state.Topic?.Difficulty));
        var bktResult = BktIrtCalculator.ApplyUpdate(
            state.MasteryProbability, state.GuessProbability, state.SlipProbability, state.TransitionProbability,
            thetaBefore, beta, request.IsCorrect);
        state.IrtTheta = bktResult.Theta;
        state.MasteryProbability = bktResult.Mastery;
        var thetaAfter = bktResult.Theta;
        state.UpdatedAt = DateTime.UtcNow;

        var srUpdate = await UpdateSpacedRepetitionAsync(userId, request);

        await db.SaveChangesAsync();

        string? recommendation = null;
        if (state.MasteryProbability >= 0.95)
            recommendation = "Bạn đã thành thạo chủ đề này! Có thể chuyển sang chủ đề mới.";
        else if (state.MasteryProbability < 0.4)
            recommendation = "Cần ôn tập thêm chủ đề này.";

        return new UpdateBktResponse
        {
            State = MapToDto(state),
            Recommendation = recommendation,
            SpacedRepetition = srUpdate,
            ThetaBefore = thetaBefore,
            ThetaAfter = thetaAfter,
            QuestionBeta = beta
        };
    }

    public async Task<ReviewScheduleDto> GetReviewScheduleAsync(Guid userId)
    {
        var now = DateTime.UtcNow;
        var items = await db.SpacedRepetitionItems
            .Where(sr => sr.UserId == userId)
            .Include(sr => sr.Topic)
            .Include(sr => sr.Question)
            .OrderBy(sr => sr.NextReviewDate)
            .ToListAsync();

        var dueItems = items
            .Where(sr => spacedRepetition.IsDueForReview(sr.NextReviewDate, now))
            .Select(sr => MapReviewItem(sr, now))
            .ToList();

        return new ReviewScheduleDto
        {
            TotalDueToday = dueItems.Count,
            Items = dueItems
        };
    }

    public async Task<List<Guid>> GetDueQuestionIdsAsync(Guid userId, IEnumerable<Guid>? questionIds = null)
    {
        var now = DateTime.UtcNow;
        var query = db.SpacedRepetitionItems
            .Where(sr => sr.UserId == userId);

        if (questionIds != null)
        {
            var idSet = questionIds.ToHashSet();
            query = query.Where(sr => idSet.Contains(sr.QuestionId));
        }

        var items = await query.ToListAsync();
        return items
            .Where(sr => spacedRepetition.IsDueForReview(sr.NextReviewDate, now))
            .OrderBy(sr => sr.NextReviewDate)
            .Select(sr => sr.QuestionId)
            .ToList();
    }

    private async Task<SrUpdateDto?> UpdateSpacedRepetitionAsync(Guid userId, UpdateBktRequest request)
    {
        var item = await db.SpacedRepetitionItems
            .FirstOrDefaultAsync(sr => sr.UserId == userId && sr.QuestionId == request.QuestionId);

        if (item == null)
        {
            var question = await db.Questions.Include(q => q.Quiz).FirstOrDefaultAsync(q => q.Id == request.QuestionId);
            if (question == null) return null;

            item = new SpacedRepetitionItem
            {
                UserId = userId,
                QuestionId = request.QuestionId,
                TopicId = request.TopicId,
            };
            db.SpacedRepetitionItems.Add(item);
        }

        var quality = spacedRepetition.ComputeQuality(request.IsCorrect, request.ResponseTime);
        var result = spacedRepetition.ApplyReview(item, quality, request.IsCorrect);

        return new SrUpdateDto
        {
            NextReviewDate = result.NextReviewDate.ToString("yyyy-MM-dd"),
            ReviewInterval = result.ReviewInterval,
            RepetitionCount = result.RepetitionCount,
            IntervalChanged = result.IntervalChanged,
            PreviousInterval = result.PreviousInterval
        };
    }

    private static ReviewItemDto MapReviewItem(SpacedRepetitionItem sr, DateTime now)
    {
        var overdueHours = sr.NextReviewDate <= now
            ? (now - sr.NextReviewDate).TotalHours
            : (double?)null;

        var questionText = sr.Question?.Text ?? "";
        if (questionText.Length > 120)
            questionText = questionText[..117] + "...";

        return new ReviewItemDto
        {
            QuestionId = sr.QuestionId.ToString(),
            TopicId = sr.TopicId.ToString(),
            TopicName = sr.Topic?.Name ?? "",
            QuestionText = questionText,
            NextReviewDate = sr.NextReviewDate.ToString("yyyy-MM-dd"),
            LastReviewDate = sr.LastReviewDate.ToString("yyyy-MM-dd"),
            RetentionScore = sr.RetentionScore,
            RepetitionCount = sr.RepetitionCount,
            ReviewInterval = sr.ReviewInterval,
            EaseFactor = sr.EaseFactor,
            OverdueHours = overdueHours
        };
    }

    private static BktStateDto MapToDto(BktState state) => new()
    {
        TopicId = state.TopicId.ToString(),
        TopicName = state.Topic?.Name ?? "",
        MasteryProbability = state.MasteryProbability,
        GuessProbability = state.GuessProbability,
        SlipProbability = state.SlipProbability,
        TransitionProbability = state.TransitionProbability,
        IrtTheta = state.IrtTheta,
        UpdatedAt = state.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss")
    };
}
