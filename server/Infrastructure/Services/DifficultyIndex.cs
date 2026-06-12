namespace EduBoost.API.Infrastructure.Services;

public static class DifficultyIndex
{
    public const double MinBeta = -3.0;
    public const double MaxBeta = 3.0;

    public static double Clamp(double beta) => Math.Clamp(beta, MinBeta, MaxBeta);

    public static double FromDifficultyLabel(string? label) =>
        (label ?? "medium").Trim().ToLowerInvariant() switch
        {
            "easy" => -1.5,
            "hard" => 1.5,
            _ => 0.0
        };

    public static string ToDifficultyLabel(double beta) =>
        beta <= -0.75 ? "easy" : beta >= 0.75 ? "hard" : "medium";

    public static (double Min, double Max) CEFRange(string? cefrLevel) =>
        (cefrLevel ?? "").Trim().ToUpperInvariant() switch
        {
            "A1" => (-3.0, -2.0),
            "A2" => (-2.0, -1.0),
            "B1" => (-1.0, 0.0),
            "B2" => (0.0, 1.0),
            "C1" => (1.0, 2.0),
            "C2" => (2.0, 3.0),
            _ => (MinBeta, MaxBeta),
        };

    public static double TopicDifficultyToBeta(string? topicDifficulty) =>
        FromDifficultyLabel(topicDifficulty);
}
