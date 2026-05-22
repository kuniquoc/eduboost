using System.Text;
using System.Text.Json;

namespace EduBoost.API.Infrastructure.Services;

public interface IAgentService
{
    Task<AgentNextActionResponse?> GetNextActionAsync(string studentId, string topicName);
    Task<AgentStateResponse?> UpdateStateAsync(string studentId, string topicName, double difficulty, bool isCorrect);
    Task<AgentQuizResponse?> GenerateQuizQuestionAsync(string topicName, double difficulty);
    Task<string?> GetExplanationAsync(string topicName, string studentState);
    Task<string?> GetGraderExplanationAsync(string question, string correctAnswer, string studentAnswer);
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

    public AgentService(HttpClient http, ILogger<AgentService> logger)
    {
        _http = http;
        _http.BaseAddress = new Uri("http://host.docker.internal:8000");
        _http.Timeout = TimeSpan.FromSeconds(120); // LLM calls can be slow
        _logger = logger;
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

    public async Task<AgentQuizResponse?> GenerateQuizQuestionAsync(string topicName, double difficulty)
    {
        try
        {
            var response = await _http.GetAsync($"/tutor/generate-question?topic_name={Uri.EscapeDataString(topicName)}&difficulty={difficulty}");
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

    public async Task<string?> GetExplanationAsync(string topicName, string studentState)
    {
        try
        {
            var response = await _http.GetAsync($"/tutor/explain?topic_name={Uri.EscapeDataString(topicName)}&student_state={Uri.EscapeDataString(studentState)}");
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

    public async Task<string?> GetGraderExplanationAsync(string question, string correctAnswer, string studentAnswer)
    {
        try
        {
            var payload = new
            {
                question,
                correct_answer = correctAnswer,
                student_answer = studentAnswer
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
