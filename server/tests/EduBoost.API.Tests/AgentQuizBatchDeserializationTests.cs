using System.Text.Json;
using EduBoost.API.Infrastructure.Services;
using Xunit;

namespace EduBoost.API.Tests;

public class AgentQuizBatchDeserializationTests
{
    private static readonly JsonSerializerOptions DeserializeOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private static readonly JsonSerializerOptions SerializeOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    [Fact]
    public void Deserialize_QuizBatchResponse_MapsIsCorrectFromCamelCase()
    {
        const string json = """
            {
              "questions": [
                {
                  "question": "She ___ to school every day.",
                  "type": "mcq",
                  "difficulty": "easy",
                  "explanation": "Vì chủ ngữ là She...",
                  "options": [
                    { "text": "go", "isCorrect": false },
                    { "text": "goes", "isCorrect": true },
                    { "text": "going", "isCorrect": false },
                    { "text": "gone", "isCorrect": false }
                  ]
                }
              ]
            }
            """;

        var result = JsonSerializer.Deserialize<AgentQuizBatchResponse>(json, DeserializeOpts);

        Assert.NotNull(result);
        Assert.Single(result!.Questions);
        var options = result.Questions[0].Options;
        Assert.Equal(4, options.Count);
        Assert.False(options[0].IsCorrect);
        Assert.True(options[1].IsCorrect);
        Assert.False(options[2].IsCorrect);
        Assert.False(options[3].IsCorrect);
    }

    [Fact]
    public void Serialize_QuizBatchPayload_IncludesExistingQuestionsAsSnakeCase()
    {
        var payload = new
        {
            topic_name = "English Grammar",
            user_prompt = (string?)null,
            doc_url = "https://example.com/doc.pdf",
            document_id = "83d72111-f401-4ac4-92c9-d733d68ad986",
            num_questions = 6,
            difficulty = "mixed",
            num_easy = 2,
            num_medium = 2,
            num_hard = 2,
            existing_questions = new[] { "She ___ to school.", "He ___ to work." }
        };

        var json = JsonSerializer.Serialize(payload, SerializeOpts);

        Assert.Contains("\"existing_questions\"", json);
        Assert.Contains("She ___ to school.", json);
        Assert.Contains("He ___ to work.", json);
        Assert.DoesNotContain("existingQuestions", json);
    }

    [Fact]
    public void AgentService_QuizBatchHttpClientName_MatchesRegistration()
    {
        Assert.Equal("AgentQuizBatch", AgentService.QuizBatchHttpClientName);
    }
}
