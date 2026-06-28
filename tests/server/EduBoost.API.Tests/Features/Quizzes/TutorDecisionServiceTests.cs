using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using Xunit;

namespace EduBoost.API.Tests;

public class TutorDecisionServiceTests
{
    private readonly TutorDecisionService _service = new();

    [Theory]
    [InlineData(0.2, "EXPLAIN")]
    [InlineData(0.6, "QUIZ")]
    [InlineData(0.9, "QUIZ")]
    [InlineData(0.95, "NEXT_SKILL")]
    public void DecideNextAction_UsesBktThresholds(double mastery, string expectedAction)
    {
        var result = _service.DecideNextAction("Algebra", mastery);

        Assert.Equal(expectedAction, result.Action);
    }

    [Fact]
    public void DecideNextAction_QuizIncludesBetaParam()
    {
        var result = _service.DecideNextAction("Algebra", 0.6, irtTheta: 0.4);

        Assert.Equal("QUIZ", result.Action);
        Assert.NotNull(result.Params);
        Assert.Equal(0.4, result.Params!["beta"]);
    }

    [Fact]
    public void MapMasteryToDifficulty_UsesIrtThetaWhenPresent()
    {
        Assert.Equal(0.5, _service.MapMasteryToDifficulty(0.3, irtTheta: 0.5));
    }
}
