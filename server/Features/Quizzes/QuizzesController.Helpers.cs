using EduBoost.API.Features.Quizzes.Models;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;

namespace EduBoost.API.Features.Quizzes;

public partial class QuizzesController
{
    private static bool TryNormalizeAgentQuestion(AgentQuizResponse question)
    {
        if (string.IsNullOrWhiteSpace(question.Question) || question.Options.Count < 2)
            return false;

        var options = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in question.Options)
        {
            if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(value)) continue;
            options[key.Trim()] = value.Trim();
        }

        if (options.Count < 2 || string.IsNullOrWhiteSpace(question.CorrectAnswer))
            return false;

        var rawCorrectAnswer = question.CorrectAnswer.Trim();
        var correctKey = options.Keys.FirstOrDefault(key =>
            string.Equals(key, rawCorrectAnswer, StringComparison.OrdinalIgnoreCase));
        correctKey ??= options.FirstOrDefault(option =>
            string.Equals(option.Value, rawCorrectAnswer, StringComparison.OrdinalIgnoreCase)).Key;

        if (string.IsNullOrWhiteSpace(correctKey)) return false;

        question.Question = question.Question.Trim();
        question.Options = options;
        question.CorrectAnswer = correctKey;
        question.Explanation = question.Explanation?.Trim() ?? "";
        return true;
    }

    private static bool IsDuplicateTutorQuestion(string question, IEnumerable<string> existingQuestions)
    {
        var normalized = NormalizeQuestionText(question);
        return !string.IsNullOrEmpty(normalized)
            && existingQuestions.Any(existing => NormalizeQuestionText(existing) == normalized);
    }

    private static string NormalizeQuestionText(string question) => new(
        question
            .Where(character => character is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9')
            .Select(char.ToLowerInvariant)
            .ToArray());

    private static OptionDto? FindTutorSelectedOption(QuestionDto question, string selectedAnswer)
    {
        var selected = selectedAnswer.Trim();
        for (var index = 0; index < question.Options.Count; index++)
        {
            var option = question.Options[index];
            var key = ((char)('A' + index)).ToString();
            if (string.Equals(selected, key, StringComparison.OrdinalIgnoreCase)
                || string.Equals(selected, option.Id, StringComparison.OrdinalIgnoreCase)
                || string.Equals(selected, option.Text, StringComparison.OrdinalIgnoreCase))
            {
                return option;
            }
        }
        return null;
    }
}
