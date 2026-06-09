using System.Text.RegularExpressions;

namespace EduBoost.API.Features.Topics;

public static class TopicDifficultyParser
{
    public static string? ParseFromAiResponse(string? answer)
    {
        if (string.IsNullOrWhiteSpace(answer)) return null;
        var match = Regex.Match(answer, @"\b(easy|medium|hard)\b", RegexOptions.IgnoreCase);
        return match.Success ? match.Value.ToLowerInvariant() : null;
    }

    public static string HeuristicFromQuestionCount(int questionCount) =>
        questionCount >= 10 ? "hard" : questionCount >= 6 ? "medium" : "easy";
}
