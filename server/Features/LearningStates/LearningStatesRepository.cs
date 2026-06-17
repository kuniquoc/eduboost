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
            ThetaBefore = thetaBefore,
            ThetaAfter = thetaAfter,
            QuestionBeta = beta
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
