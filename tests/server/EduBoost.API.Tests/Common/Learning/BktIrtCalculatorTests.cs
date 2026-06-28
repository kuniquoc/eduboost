using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using Xunit;

namespace EduBoost.API.Tests;

public class BktIrtCalculatorTests
{
    [Fact]
    public void ApplyUpdate_ThreeCorrectAnswers_DoesNotReachMasteryThreshold()
    {
        var mastery = 0.3;
        var theta = 0.0;

        for (var i = 0; i < 3; i++)
        {
            var result = BktIrtCalculator.ApplyUpdate(
                mastery,
                BktIrtCalculator.DefaultGuessProbability,
                BktIrtCalculator.DefaultSlipProbability,
                BktIrtCalculator.DefaultTransitionProbability,
                theta,
                beta: 0,
                isCorrect: true);

            mastery = result.Mastery;
            theta = result.Theta;
        }

        Assert.InRange(mastery, 0.80, 0.95);
    }

    [Fact]
    public void ApplyUpdate_CorrectAndWrongAnswers_MoveMasteryInExpectedDirections()
    {
        var correct = BktIrtCalculator.ApplyUpdate(
            mastery: 0.3,
            guess: BktIrtCalculator.DefaultGuessProbability,
            slip: BktIrtCalculator.DefaultSlipProbability,
            transition: BktIrtCalculator.DefaultTransitionProbability,
            theta: 0,
            beta: 0,
            isCorrect: true);

        var wrong = BktIrtCalculator.ApplyUpdate(
            mastery: 0.7,
            guess: BktIrtCalculator.DefaultGuessProbability,
            slip: BktIrtCalculator.DefaultSlipProbability,
            transition: BktIrtCalculator.DefaultTransitionProbability,
            theta: 0,
            beta: 0,
            isCorrect: false);

        Assert.True(correct.Mastery > 0.3);
        Assert.True(wrong.Mastery < 0.7);
    }
}
