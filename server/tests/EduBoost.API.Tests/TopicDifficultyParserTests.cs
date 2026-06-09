using EduBoost.API.Features.Topics;
using Xunit;

namespace EduBoost.API.Tests;

public class TopicDifficultyParserTests
{
    [Theory]
    [InlineData("The difficulty is medium for this topic.", "medium")]
    [InlineData("HARD", "hard")]
    [InlineData("easy", "easy")]
    [InlineData("unclear response", null)]
    public void ParseFromAiResponse_ExtractsDifficulty(string input, string? expected)
    {
        Assert.Equal(expected, TopicDifficultyParser.ParseFromAiResponse(input));
    }

    [Theory]
    [InlineData(3, "easy")]
    [InlineData(7, "medium")]
    [InlineData(12, "hard")]
    public void HeuristicFromQuestionCount_MapsBands(int count, string expected)
    {
        Assert.Equal(expected, TopicDifficultyParser.HeuristicFromQuestionCount(count));
    }
}
