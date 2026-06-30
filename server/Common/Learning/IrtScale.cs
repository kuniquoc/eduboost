namespace EduBoost.API.Common.Learning;

public static class IrtScale
{
    public const double Min = -3.0;
    public const double Max = 3.0;
    public const double EasyPrior = -1.0986122886681098;
    public const double MediumPrior = 0.0;
    public const double HardPrior = 1.0986122886681098;
    public const double BandBoundary = 0.6190392084062235;

    public static double Clamp(double value) => Math.Clamp(value, Min, Max);

    public static double PriorFromBand(string? band) =>
        (band ?? "medium").Trim().ToLowerInvariant() switch
        {
            "easy" => EasyPrior,
            "hard" => HardPrior,
            _ => MediumPrior
        };

    public static string BandFromBeta(double beta) =>
        beta <= -BandBoundary ? "easy" : beta >= BandBoundary ? "hard" : "medium";
}
