namespace EduBoost.API.Infrastructure.Services;

public static class AgentQuizValidation
{
    public static List<AgentQuizBatchQuestion> FilterQuestionsWithSingleCorrectOption(
        IEnumerable<AgentQuizBatchQuestion> questions,
        ILogger? logger = null)
    {
        var valid = new List<AgentQuizBatchQuestion>();

        foreach (var question in questions)
        {
            var type = string.IsNullOrWhiteSpace(question.Type) ? "mcq" : question.Type;
            if (!string.Equals(type, "mcq", StringComparison.OrdinalIgnoreCase))
            {
                valid.Add(question);
                continue;
            }

            var correctCount = question.Options.Count(o => o.IsCorrect);
            if (correctCount == 1)
            {
                valid.Add(question);
                continue;
            }

            logger?.LogWarning(
                "Skipping MCQ without exactly one correct option (got {Count}): {Question}",
                correctCount,
                question.Question);
        }

        return valid;
    }
}
