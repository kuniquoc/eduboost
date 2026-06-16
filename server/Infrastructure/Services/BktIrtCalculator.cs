namespace EduBoost.API.Infrastructure.Services;

/// <summary>In-memory BKT + 1PL IRT update logic shared by DB persistence and practice sessions.</summary>
public static class BktIrtCalculator
{
    public record UpdateResult(double Mastery, double Theta, double ThetaBefore, double Beta);

    public static UpdateResult ApplyUpdate(
        double mastery,
        double guess,
        double slip,
        double transition,
        double theta,
        double beta,
        bool isCorrect)
    {
        var clampedBeta = DifficultyIndex.Clamp(beta);
        var thetaBefore = theta;
        var thetaAfter = UpdateTheta(thetaBefore, clampedBeta, isCorrect);

        double pL = mastery;
        double pG = guess;
        double pS = slip;
        double pT = transition;

        double pCorrectGivenMastered = 1.0 - pS;
        double pCorrectGivenNotMastered = pG;
        double pCorrect = pL * pCorrectGivenMastered + (1 - pL) * pCorrectGivenNotMastered;

        double pLGivenObs;
        if (isCorrect)
            pLGivenObs = (pL * pCorrectGivenMastered) / pCorrect;
        else
        {
            double pIncorrect = 1.0 - pCorrect;
            pLGivenObs = (pL * pS) / pIncorrect;
        }

        double newMastery = Math.Clamp(pLGivenObs + (1 - pLGivenObs) * pT, 0.0, 1.0);

        return new UpdateResult(newMastery, thetaAfter, thetaBefore, clampedBeta);
    }

    public static double UpdateTheta(double theta, double beta, bool isCorrect)
    {
        const double learningRate = 0.35;
        var expected = 1.0 / (1.0 + Math.Exp(-(theta - beta)));
        var observed = isCorrect ? 1.0 : 0.0;
        var updated = theta + learningRate * (observed - expected);
        return Math.Clamp(updated, -3.0, 3.0);
    }
}
