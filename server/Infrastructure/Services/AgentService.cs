using System.Text;
using System.Text.Json;

namespace EduBoost.API.Infrastructure.Services;

public interface IAgentService
{
    Task<AgentNextActionResponse?> GetNextActionAsync(string studentId, string topicName);
    Task<AgentStateResponse?> UpdateStateAsync(string studentId, string topicName, double difficulty, bool isCorrect);
    Task<AgentQuizResponse?> GenerateQuizQuestionAsync(string topicName, double difficulty, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null);
    Task<string?> GetExplanationAsync(string topicName, string studentState, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null);
    Task<string?> GetGraderExplanationAsync(string question, string correctAnswer, string studentAnswer, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null);
    Task<AgentQuizBatchResponse?> GenerateQuizBatchAsync(string topicName, string? userPrompt, string? docUrl, int numQuestions, string difficulty, int numEasy = 0, int numMedium = 0, int numHard = 0);
    Task<AgentChatResponse> AskAsync(string question, string? topicId, string level, List<ChatMessage> history, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null);
    Task IngestDocumentAsync(string documentId, string fileUrl, string scope, string? classId = null, string? ownerId = null, string? topicId = null);
    Task DeleteDocumentAsync(string documentId);
}

public class AgentService : IAgentService
{
    private readonly HttpClient _http;
    private readonly ILogger<AgentService> _logger;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    public AgentService(HttpClient http, ILogger<AgentService> logger, IConfiguration config)
    {
        _http = http;

        var configuredBaseUrl = config["AIAgent:BaseUrl"];
        if (string.IsNullOrWhiteSpace(configuredBaseUrl))
        {
            configuredBaseUrl = "http://host.docker.internal:8000";
        }
        else if (!configuredBaseUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
              && !configuredBaseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            configuredBaseUrl = $"http://{configuredBaseUrl}";
        }

        _http.BaseAddress = new Uri(configuredBaseUrl);
        _http.Timeout = TimeSpan.FromSeconds(120); // LLM calls can be slow
        _logger = logger;

        _logger.LogInformation("AI Agent base URL configured: {BaseUrl}", _http.BaseAddress);
    }

    public async Task<AgentNextActionResponse?> GetNextActionAsync(string studentId, string topicName)
    {
        try
        {
            var response = await _http.GetAsync($"/tutor/next-action?student_id={Uri.EscapeDataString(studentId)}&topic_name={Uri.EscapeDataString(topicName)}");
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<AgentNextActionResponse>(json, JsonOpts);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AI Agent unavailable for GetNextAction (student={StudentId}, topic={Topic})", studentId, topicName);
            return null;
        }
    }

    public async Task<AgentStateResponse?> UpdateStateAsync(string studentId, string topicName, double difficulty, bool isCorrect)
    {
        try
        {
            var payload = new
            {
                student_id = studentId,
                topic_name = topicName,
                difficulty,
                is_correct = isCorrect
            };
            var content = new StringContent(JsonSerializer.Serialize(payload, JsonOpts), Encoding.UTF8, "application/json");
            var response = await _http.PostAsync("/tutor/update-state", content);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<AgentStateResponse>(json, JsonOpts);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AI Agent unavailable for UpdateState (student={StudentId}, topic={Topic})", studentId, topicName);
            return null;
        }
    }

    public async Task<AgentQuizResponse?> GenerateQuizQuestionAsync(string topicName, double difficulty, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null)
    {
        try
        {
            var queryParams = $"/tutor/generate-question?topic_name={Uri.EscapeDataString(topicName)}&difficulty={difficulty}";
            if (allowedDocumentIds?.Count > 0)
                queryParams += $"&allowed_document_ids={Uri.EscapeDataString(string.Join(",", allowedDocumentIds))}";
            if (allowedScopes?.Count > 0)
                queryParams += $"&allowed_scopes={Uri.EscapeDataString(string.Join(",", allowedScopes))}";

            var response = await _http.GetAsync(queryParams);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<AgentQuizResponse>(json, JsonOpts);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AI Agent unavailable for GenerateQuizQuestion (topic={Topic})", topicName);
            return null;
        }
    }

    public async Task<string?> GetExplanationAsync(string topicName, string studentState, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null)
    {
        try
        {
            var queryParams = $"/tutor/explain?topic_name={Uri.EscapeDataString(topicName)}&student_state={Uri.EscapeDataString(studentState)}";
            if (allowedDocumentIds?.Count > 0)
                queryParams += $"&allowed_document_ids={Uri.EscapeDataString(string.Join(",", allowedDocumentIds))}";
            if (allowedScopes?.Count > 0)
                queryParams += $"&allowed_scopes={Uri.EscapeDataString(string.Join(",", allowedScopes))}";

            var response = await _http.GetAsync(queryParams);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty("explanation", out var explanation)
                ? explanation.GetString()
                : json;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AI Agent unavailable for GetExplanation (topic={Topic})", topicName);
            return null;
        }
    }

    public async Task<string?> GetGraderExplanationAsync(string question, string correctAnswer, string studentAnswer, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null)
    {
        try
        {
            var payload = new
            {
                question,
                correct_answer = correctAnswer,
                student_answer = studentAnswer,
                allowed_document_ids = allowedDocumentIds,
                allowed_scopes = allowedScopes
            };
            var content = new StringContent(JsonSerializer.Serialize(payload, JsonOpts), Encoding.UTF8, "application/json");
            var response = await _http.PostAsync("/tutor/explain-error", content);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty("explanation", out var explanation)
                ? explanation.GetString()
                : json;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AI Agent unavailable for GetGraderExplanation");
            return null;
        }
    }

    public async Task<AgentQuizBatchResponse?> GenerateQuizBatchAsync(
        string topicName, string? userPrompt, string? docUrl, int numQuestions, string difficulty, int numEasy = 0, int numMedium = 0, int numHard = 0)
    {
        try
        {
            var payload = new
            {
                topic_name = topicName,
                user_prompt = userPrompt,
                doc_url = docUrl,
                num_questions = numQuestions,
                difficulty,
                num_easy = numEasy,
                num_medium = numMedium,
                num_hard = numHard
            };
            var content = new StringContent(JsonSerializer.Serialize(payload, JsonOpts), Encoding.UTF8, "application/json");
            var response = await _http.PostAsync("/tutor/generate-quiz", content);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<AgentQuizBatchResponse>(json, JsonOpts);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AI Agent unavailable for GenerateQuizBatch (topic={Topic})", topicName);
            return null;
        }
    }

    public async Task<AgentChatResponse> AskAsync(string question, string? topicId, string level, List<ChatMessage> history, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null)
    {
        try
        {
            var payload = new
            {
                question,
                topic_id = topicId,
                level,
                history = history.Select(m => new { m.Role, m.Content }),
                allowed_document_ids = allowedDocumentIds,
                allowed_scopes = allowedScopes
            };
            var content = new StringContent(JsonSerializer.Serialize(payload, JsonOpts), Encoding.UTF8, "application/json");
            var response = await _http.PostAsync("/tutor/chat", content);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<AgentChatResponse>(json, JsonOpts) ?? new AgentChatResponse { Answer = "Không thể kết nối AI" };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AI Agent unavailable for Ask");
            return new AgentChatResponse { Answer = "AI hiện không khả dụng. Vui lòng thử lại sau." };
        }
    }

    public async Task IngestDocumentAsync(string documentId, string fileUrl, string scope, string? classId = null, string? ownerId = null, string? topicId = null)
    {
        try
        {
            var payload = new
            {
                document_id = documentId,
                file_url = fileUrl,
                scope,
                class_id = classId,
                owner_id = ownerId,
                topic_id = topicId
            };
            var content = new StringContent(JsonSerializer.Serialize(payload, JsonOpts), Encoding.UTF8, "application/json");
            var response = await _http.PostAsync("/rag/ingest", content);
            response.EnsureSuccessStatusCode();
            _logger.LogInformation("Successfully called AI Agent to ingest document {DocId}", documentId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to call AI Agent `/rag/ingest` for document {DocId}", documentId);
        }
    }

    public async Task DeleteDocumentAsync(string documentId)
    {
        try
        {
            var payload = new { document_id = documentId };
            var content = new StringContent(JsonSerializer.Serialize(payload, JsonOpts), Encoding.UTF8, "application/json");
            var response = await _http.PostAsync("/rag/delete", content);
            response.EnsureSuccessStatusCode();
            _logger.LogInformation("Successfully called AI Agent to delete document {DocId}", documentId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to call AI Agent `/rag/delete` for document {DocId}", documentId);
        }
    }
}

// ── Response DTOs ────────────────────────────────────────────────────────────

public class AgentNextActionResponse
{
    public string Action { get; set; } = ""; // EXPLAIN, QUIZ, NEXT_SKILL
    public string? Adapter { get; set; }
    public string Reason { get; set; } = "";
    public Dictionary<string, object>? Params { get; set; }
}

public class AgentStateResponse
{
    public string StudentId { get; set; } = "";
    public string Skill { get; set; } = "";
    public double NewP { get; set; }
    public double NewTheta { get; set; }
    public string Mastery { get; set; } = "";
}

public class AgentQuizResponse
{
    public string Question { get; set; } = "";
    public Dictionary<string, string> Options { get; set; } = new();
    public string CorrectAnswer { get; set; } = "";
    public string Explanation { get; set; } = "";
    public double DifficultyLevel { get; set; }
}

public class AgentQuizBatchOption
{
    public string Text { get; set; } = "";
    public bool IsCorrect { get; set; }
}

public class AgentQuizBatchQuestion
{
    public string Question { get; set; } = "";
    public string Type { get; set; } = "mcq";
    public string Difficulty { get; set; } = "medium";
    public string Explanation { get; set; } = "";
    public List<AgentQuizBatchOption> Options { get; set; } = [];
}

public class AgentQuizBatchResponse
{
    public List<AgentQuizBatchQuestion> Questions { get; set; } = [];
}

public class ChatMessage
{
    public string Role { get; set; } = "";
    public string Content { get; set; } = "";
}

public class AgentChatResponse
{
    public string Answer { get; set; } = "";
    public List<AgentSourceReference> Sources { get; set; } = [];
}

public class AgentSourceReference
{
    public string DocumentId { get; set; } = "";
    public string FileName { get; set; } = "";
    public string? Snippet { get; set; }
}
