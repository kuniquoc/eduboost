using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using Xunit;

namespace EduBoost.API.Tests;

public class LearningCalculatorTests
{
    [Fact]
    public void BktUpdate_CorrectAndWrongAnswers_MoveMasteryInExpectedDirections()
    {
        var correct = BktCalculator.Update(0.3, isCorrect: true);
        var wrong = BktCalculator.Update(0.7, isCorrect: false);

        Assert.True(correct > 0.3);
        Assert.True(wrong < 0.7);
    }

    [Fact]
    public void RaschEstimate_MovesThetaTowardObservedPerformance()
    {
        var correct = Rasch1PlEstimator.Estimate([new RaschObservation(0, true)]);
        var wrong = Rasch1PlEstimator.Estimate([new RaschObservation(0, false)]);

        Assert.True(correct.Theta > 0);
        Assert.True(wrong.Theta < 0);
        Assert.Equal(1, correct.ResponseCount);
        Assert.InRange(correct.StandardError, 0, 1);
    }

    [Theory]
    [InlineData("easy", IrtScale.EasyPrior)]
    [InlineData("medium", IrtScale.MediumPrior)]
    [InlineData("hard", IrtScale.HardPrior)]
    public void IrtScale_RoundTripsDifficultyBands(string band, double beta)
    {
        Assert.Equal(beta, IrtScale.PriorFromBand(band));
        Assert.Equal(band, IrtScale.BandFromBeta(beta));
    }
}
