using EduBoost.API.Infrastructure.Entities;

namespace EduBoost.API.Common.Learning;

public static class QuestionGrader
{
    public static bool Grade(Question question, IEnumerable<string>? selectedOptionIds, string? textAnswer)
    {
        if (string.Equals(question.Type, "fill_blank", StringComparison.OrdinalIgnoreCase))
            return string.Equals(question.CorrectAnswer?.Trim(), textAnswer?.Trim(), StringComparison.OrdinalIgnoreCase);

        var selected = (selectedOptionIds ?? []).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var correct = question.Options.Where(o => o.IsCorrect).Select(o => o.Id.ToString()).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return selected.SetEquals(correct) && correct.Count > 0;
    }
}
