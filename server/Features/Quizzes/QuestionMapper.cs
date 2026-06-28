using EduBoost.API.Features.Quizzes.Models;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;

namespace EduBoost.API.Features.Quizzes;

internal static class QuestionMapper
{
    public static QuestionDto ToDto(Question question) => new()
    {
        Id = question.Id.ToString(),
        QuizId = question.QuizId.ToString(),
        TopicId = question.Quiz?.TopicId?.ToString() ?? "",
        Text = question.Text,
        Type = question.Type,
        Difficulty = question.Difficulty,
        DifficultyIndex = question.DifficultyIndex,
        IsEstimatedDifficultyIndex = question.IsEstimatedDifficultyIndex,
        Explanation = question.Explanation,
        CorrectAnswer = question.CorrectAnswer,
        VerifiedByTeacher = question.VerifiedByTeacher,
        OrderIndex = question.OrderIndex,
        Options = question.Options
            .OrderBy(option => option.OrderIndex)
            .Select(option => new OptionDto
            {
                Id = option.Id.ToString(),
                Text = option.Text,
                IsCorrect = option.IsCorrect
            })
            .ToList()
    };

    public static double ResolveDifficultyIndex(double? difficultyIndex, string? difficultyLabel) =>
        difficultyIndex.HasValue
            ? DifficultyIndex.Clamp(difficultyIndex.Value)
            : DifficultyIndex.FromDifficultyLabel(difficultyLabel);

    public static Question FromAgent(
        AgentQuizBatchQuestion source,
        int orderIndex,
        Guid? sourceDocumentId = null) => new()
    {
        Id = Guid.NewGuid(),
        SourceDocumentId = sourceDocumentId,
        Text = source.Question,
        Type = string.IsNullOrWhiteSpace(source.Type) ? "mcq" : source.Type,
        Difficulty = string.IsNullOrWhiteSpace(source.Difficulty) ? "medium" : source.Difficulty,
        DifficultyIndex = ResolveDifficultyIndex(source.DifficultyIndex, source.Difficulty),
        IsEstimatedDifficultyIndex = !source.DifficultyIndex.HasValue,
        Explanation = source.Explanation,
        CorrectAnswer = source.Options.FirstOrDefault(option => option.IsCorrect)?.Text ?? "",
        VerifiedByTeacher = false,
        OrderIndex = orderIndex,
        Options = source.Options.Select((option, index) => new QuizOption
        {
            Id = Guid.NewGuid(),
            Text = option.Text,
            IsCorrect = option.IsCorrect,
            OrderIndex = index
        }).ToList()
    };

    public static Question CloneForQuiz(Question source, int orderIndex, bool verifiedByTeacher) => new()
    {
        Id = Guid.NewGuid(),
        Text = source.Text,
        Type = source.Type,
        Difficulty = source.Difficulty,
        DifficultyIndex = source.DifficultyIndex,
        IsEstimatedDifficultyIndex = source.IsEstimatedDifficultyIndex,
        Explanation = source.Explanation,
        CorrectAnswer = source.CorrectAnswer,
        VerifiedByTeacher = verifiedByTeacher,
        OrderIndex = orderIndex,
        SourceTopicId = source.Quiz?.TopicId,
        Options = source.Options.Select((option, index) => new QuizOption
        {
            Id = Guid.NewGuid(),
            Text = option.Text,
            IsCorrect = option.IsCorrect,
            OrderIndex = index
        }).ToList()
    };
}
