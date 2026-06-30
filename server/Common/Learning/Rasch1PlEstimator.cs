namespace EduBoost.API.Common.Learning;

public readonly record struct RaschObservation(double Beta, bool IsCorrect);
public readonly record struct RaschEstimate(double Theta, double StandardError, int ResponseCount);

public static class Rasch1PlEstimator
{
    private const double PriorVariance = 1.0;
    private const int MaxIterations = 25;
    private const double Tolerance = 1e-6;

    public static double Probability(double theta, double beta)
    {
        var x = Math.Clamp(theta - beta, -35.0, 35.0);
        return 1.0 / (1.0 + Math.Exp(-x));
    }

    public static RaschEstimate Estimate(IEnumerable<RaschObservation> source)
    {
        var observations = source.ToList();
        var theta = 0.0;

        for (var iteration = 0; iteration < MaxIterations; iteration++)
        {
            var gradient = -theta / PriorVariance;
            var information = 1.0 / PriorVariance;
            foreach (var observation in observations)
            {
                var p = Probability(theta, observation.Beta);
                gradient += (observation.IsCorrect ? 1.0 : 0.0) - p;
                information += p * (1.0 - p);
            }

            var next = IrtScale.Clamp(theta + gradient / information);
            if (Math.Abs(next - theta) < Tolerance)
            {
                theta = next;
                break;
            }
            theta = next;
        }

        var finalInformation = 1.0 / PriorVariance;
        foreach (var observation in observations)
        {
            var p = Probability(theta, observation.Beta);
            finalInformation += p * (1.0 - p);
        }

        return new RaschEstimate(theta, 1.0 / Math.Sqrt(finalInformation), observations.Count);
    }

    public static double FisherInformation(double theta, double beta)
    {
        var p = Probability(theta, beta);
        return p * (1.0 - p);
    }
}
