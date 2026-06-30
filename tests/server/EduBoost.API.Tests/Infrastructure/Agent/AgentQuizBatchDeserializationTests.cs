using System.Text.Json;
using EduBoost.API.Features.AiChat.Models;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
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

    private static readonly JsonSerializerOptions SourceReferenceJsonOpts = new()
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
    public void Deserialize_AgentQuizResponse_MapsTutorSnakeCaseFields()
    {
        const string json = """
            {
              "question": "She ___ to school every day.",
              "options": {
                "A": "go",
                "B": "goes",
                "C": "going",
                "D": "gone"
              },
              "correct_answer": "B",
              "explanation": "Vì chủ ngữ là She...",
              "initial_irt_beta": 0.42
            }
            """;

        var result = JsonSerializer.Deserialize<AgentQuizResponse>(json, DeserializeOpts);

        Assert.NotNull(result);
        Assert.Equal("B", result!.CorrectAnswer);
        Assert.Equal(0.42, result.InitialIrtBeta);
    }

    [Fact]
    public void Deserialize_AgentChatResponse_MapsSnakeCaseSourceReferences()
    {
        const string json = """
            {
              "answer": "Present simple is used for habits.",
              "sources": [
                {
                  "document_id": "doc-chat-1",
                  "file_name": "grammar.txt",
                  "snippet": "Present simple is used for habits and repeated actions."
                }
              ]
            }
            """;

        var result = JsonSerializer.Deserialize<AgentChatResponse>(json, DeserializeOpts);

        Assert.NotNull(result);
        var source = Assert.Single(result!.Sources);
        Assert.Equal("doc-chat-1", source.DocumentId);
        Assert.Equal("grammar.txt", source.FileName);
        Assert.Equal("Present simple is used for habits and repeated actions.", source.Snippet);
    }

    [Fact]
    public void Deserialize_SourceReferenceDtoHistory_MapsSnakeCaseSourceReferences()
    {
        const string json = """
            [
              {
                "document_id": "doc-history-1",
                "file_name": "history-grammar.txt",
                "snippet": "A source stored in chat history."
              }
            ]
            """;

        var result = JsonSerializer.Deserialize<List<SourceReferenceDto>>(json, SourceReferenceJsonOpts);

        var source = Assert.Single(result!);
        Assert.Equal("doc-history-1", source.DocumentId);
        Assert.Equal("history-grammar.txt", source.FileName);
        Assert.Equal("A source stored in chat history.", source.Snippet);
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
    public void Serialize_TutorQuestionPayload_IncludesExistingQuestionsAsSnakeCase()
    {
        var payload = new
        {
            topic_name = "English Grammar",
            difficulty = 0.35,
            allowed_document_ids = new[] { "doc-1" },
            allowed_scopes = new[] { "system" },
            existing_questions = new[] { "She ___ to school.", "He ___ to work." }
        };

        var json = JsonSerializer.Serialize(payload, SerializeOpts);

        Assert.Contains("\"existing_questions\"", json);
        Assert.Contains("\"allowed_document_ids\"", json);
        Assert.Contains("She ___ to school.", json);
        Assert.DoesNotContain("existingQuestions", json);
        Assert.DoesNotContain("allowedDocumentIds", json);
    }

    [Fact]
    public void AgentService_QuizBatchHttpClientName_MatchesRegistration()
    {
        Assert.Equal("AgentQuizBatch", AgentService.QuizBatchHttpClientName);
    }
}
