using EduBoost.API.Infrastructure.Integrations.Agent;

namespace EduBoost.API.Features.Quizzes.Services;

/// <summary>
/// Tutor routing from PostgreSQL BKT — mirrors agent orchestrator thresholds.
/// </summary>
public interface ITutorDecisionService
{
    AgentNextActionResponse DecideNextAction(string topicName, double masteryProbability, double irtTheta = 0);
    double MapMasteryToDifficulty(double masteryProbability, double irtTheta = 0);
}

public class TutorDecisionService : ITutorDecisionService
{
    private const double WeakThreshold = 0.5;
    private const double MasteredThreshold = 0.95;
    private const double DefaultMastery = 0.3;

    public AgentNextActionResponse DecideNextAction(string topicName, double masteryProbability, double irtTheta = 0)
    {
        var p = masteryProbability > 0 ? masteryProbability : DefaultMastery;
        var beta = MapMasteryToDifficulty(p, irtTheta);

        if (p < WeakThreshold)
        {
            return new AgentNextActionResponse
            {
                Action = "EXPLAIN",
                Adapter = "explanation_adapter",
                Reason = $"Student is weak in {topicName} (P={p:F2})",
                Params = new Dictionary<string, object>()
            };
        }

        if (p < MasteredThreshold)
        {
            return new AgentNextActionResponse
            {
                Action = "QUIZ",
                Adapter = "quiz_adapter",
                Reason = $"Student is learning {topicName} (P={p:F2})",
                Params = new Dictionary<string, object> { ["beta"] = beta }
            };
        }

        return new AgentNextActionResponse
        {
            Action = "NEXT_SKILL",
            Adapter = null,
            Reason = $"Student has mastered {topicName} (P={p:F2})",
            Params = new Dictionary<string, object>()
        };
    }

    public double MapMasteryToDifficulty(double masteryProbability, double irtTheta = 0)
    {
        if (Math.Abs(irtTheta) > 0.001)
            return Math.Clamp(irtTheta, -2.0, 2.0);

        return Math.Clamp((masteryProbability - 0.5) * 2.0, -1.0, 1.0);
    }
}
