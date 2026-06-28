using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using Xunit;

namespace EduBoost.API.Tests;

public class AgentQuizValidationTests
{
    [Fact]
    public void FilterQuestionsWithSingleCorrectOption_KeepsValidMcq()
    {
        var questions = new List<AgentQuizBatchQuestion>
        {
            new()
            {
                Question = "Valid?",
                Type = "mcq",
                Options =
                [
                    new AgentQuizBatchOption { Text = "A", IsCorrect = false },
                    new AgentQuizBatchOption { Text = "B", IsCorrect = true },
                    new AgentQuizBatchOption { Text = "C", IsCorrect = false },
                    new AgentQuizBatchOption { Text = "D", IsCorrect = false },
                ]
            }
        };

        var valid = AgentQuizValidation.FilterQuestionsWithSingleCorrectOption(questions);

        Assert.Single(valid);
    }

    [Fact]
    public void FilterQuestionsWithSingleCorrectOption_DropsMcqWithNoCorrectOption()
    {
        var questions = new List<AgentQuizBatchQuestion>
        {
            new()
            {
                Question = "Invalid?",
                Type = "mcq",
                Options =
                [
                    new AgentQuizBatchOption { Text = "A", IsCorrect = false },
                    new AgentQuizBatchOption { Text = "B", IsCorrect = false },
                    new AgentQuizBatchOption { Text = "C", IsCorrect = false },
                    new AgentQuizBatchOption { Text = "D", IsCorrect = false },
                ]
            }
        };

        var valid = AgentQuizValidation.FilterQuestionsWithSingleCorrectOption(questions);

        Assert.Empty(valid);
    }
}
