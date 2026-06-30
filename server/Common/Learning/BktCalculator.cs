namespace EduBoost.API.Common.Learning;

public static class BktCalculator
{
    public const double InitialMastery = 0.30;
    public const double GuessProbability = 0.40;
    public const double SlipProbability = 0.20;
    public const double TransitionProbability = 0.05;

    public static double Update(double mastery, bool isCorrect, double transition = TransitionProbability)
    {
        var pCorrect = mastery * (1.0 - SlipProbability) + (1.0 - mastery) * GuessProbability;
        var posterior = isCorrect
            ? mastery * (1.0 - SlipProbability) / pCorrect
            : mastery * SlipProbability / (1.0 - pCorrect);
        return Math.Clamp(posterior + (1.0 - posterior) * transition, 0.0, 1.0);
    }
}
