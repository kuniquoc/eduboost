using EduBoost.API.Features.LearningStates.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.LearningStates;

public interface ILearningStatesRepository
{
    Task<List<BktStateDto>> GetAllStatesAsync(Guid userId);
    Task<BktStateDto?> GetStateByTopicAsync(Guid userId, Guid topicId);
    Task<UpdateBktResponse> UpdateAfterAnswerAsync(Guid userId, UpdateBktRequest request);
    Task<ReviewScheduleDto> GetReviewScheduleAsync(Guid userId);
}

public class LearningStatesRepository(AppDbContext db) : ILearningStatesRepository
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

        // BKT Update (Bayesian Knowledge Tracing)
        double pL = state.MasteryProbability;
        double pG = state.GuessProbability;
        double pS = state.SlipProbability;
        double pT = state.TransitionProbability;

        double pCorrectGivenMastered = 1.0 - pS;
        double pCorrectGivenNotMastered = pG;

        double pCorrect = pL * pCorrectGivenMastered + (1 - pL) * pCorrectGivenNotMastered;

        double pLGivenObs;
        if (request.IsCorrect)
        {
            pLGivenObs = (pL * pCorrectGivenMastered) / pCorrect;
        }
        else
        {
            double pIncorrect = 1.0 - pCorrect;
            pLGivenObs = (pL * pS) / pIncorrect;
        }

        // Transition: learning
        double newPL = pLGivenObs + (1 - pLGivenObs) * pT;
        state.MasteryProbability = Math.Clamp(newPL, 0.0, 1.0);
        state.UpdatedAt = DateTime.UtcNow;

        // Update spaced repetition for this question
        await UpdateSpacedRepetitionAsync(userId, request);

        await db.SaveChangesAsync();

        string? recommendation = null;
        if (state.MasteryProbability >= 0.95)
            recommendation = "Bạn đã thành thạo chủ đề này! Có thể chuyển sang chủ đề mới.";
        else if (state.MasteryProbability < 0.4)
            recommendation = "Cần ôn tập thêm chủ đề này.";

        return new UpdateBktResponse
        {
            State = MapToDto(state),
            Recommendation = recommendation
        };
    }

    public async Task<ReviewScheduleDto> GetReviewScheduleAsync(Guid userId)
    {
        var today = DateTime.UtcNow.Date;
        var items = await db.SpacedRepetitionItems
            .Where(sr => sr.UserId == userId && sr.NextReviewDate <= today.AddDays(1))
            .Include(sr => sr.Topic)
            .OrderBy(sr => sr.NextReviewDate)
            .ToListAsync();

        return new ReviewScheduleDto
        {
            TotalDueToday = items.Count,
            Items = items.Select(sr => new ReviewItemDto
            {
                QuestionId = sr.QuestionId.ToString(),
                TopicId = sr.TopicId.ToString(),
                TopicName = sr.Topic.Name,
                NextReviewDate = sr.NextReviewDate.ToString("yyyy-MM-dd"),
                RetentionScore = sr.RetentionScore,
                RepetitionCount = sr.RepetitionCount
            }).ToList()
        };
    }

    private async Task UpdateSpacedRepetitionAsync(Guid userId, UpdateBktRequest request)
    {
        var item = await db.SpacedRepetitionItems
            .FirstOrDefaultAsync(sr => sr.UserId == userId && sr.QuestionId == request.QuestionId);

        if (item == null)
        {
            var question = await db.Questions.Include(q => q.Quiz).FirstOrDefaultAsync(q => q.Id == request.QuestionId);
            if (question == null) return;

            item = new SpacedRepetitionItem
            {
                UserId = userId,
                QuestionId = request.QuestionId,
                TopicId = request.TopicId,
                LastReviewDate = DateTime.UtcNow,
                NextReviewDate = DateTime.UtcNow.AddDays(1),
            };
            db.SpacedRepetitionItems.Add(item);
        }

        // SM-2 Algorithm
        int quality = request.IsCorrect ? 4 : 1; // simplified: correct=4, incorrect=1

        if (quality >= 3)
        {
            if (item.RepetitionCount == 0)
                item.ReviewInterval = 1;
            else if (item.RepetitionCount == 1)
                item.ReviewInterval = 6;
            else
                item.ReviewInterval = item.ReviewInterval * item.EaseFactor;

            item.RepetitionCount++;
        }
        else
        {
            item.RepetitionCount = 0;
            item.ReviewInterval = 1;
        }

        item.EaseFactor = Math.Max(1.3, item.EaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
        item.RetentionScore = request.IsCorrect ? Math.Min(1.0, item.RetentionScore + 0.1) : Math.Max(0.0, item.RetentionScore - 0.2);
        item.LastReviewDate = DateTime.UtcNow;
        item.NextReviewDate = DateTime.UtcNow.AddDays(item.ReviewInterval);
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
