using System.Text.Json;

namespace EduBoost.API.Infrastructure.Integrations.Agent;

public interface IAgentService
{
    Task<AgentNextActionResponse?> GetNextActionAsync(string studentId, string topicName, double? masteryProbability = null, double? irtTheta = null);
    Task<AgentQuizResponse?> GenerateQuizQuestionAsync(string topicName, double targetIrtBeta, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null, IReadOnlyList<string>? existingQuestions = null);
    Task<string?> GetExplanationAsync(string topicName, string studentState, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null);
    Task<string?> GetGraderExplanationAsync(string question, string correctAnswer, IReadOnlyList<AgentGraderOption>? options = null, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null);
    Task<AgentQuizBatchResponse?> GenerateQuizBatchAsync(string topicName, string? userPrompt, string? docUrl, int numQuestions, string difficulty, int numEasy = 0, int numMedium = 0, int numHard = 0, string? documentId = null, IReadOnlyList<string>? existingQuestions = null);
    Task<AgentChatResponse> AskAsync(string question, string? topicId, string level, List<ChatMessage> history, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null);
    Task IngestDocumentAsync(string documentId, string fileUrl, string scope, string? classId = null, string? ownerId = null, string? topicId = null);
    Task DeleteDocumentAsync(string documentId);
}

public class AgentService : IAgentService
{
    public const string QuizBatchHttpClientName = "AgentQuizBatch";

    private readonly HttpClient _http;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AgentService> _logger;
    public AgentService(HttpClient http, IHttpClientFactory httpClientFactory, ILogger<AgentService> logger)
    {
        _http = http;
        _httpClientFactory = httpClientFactory;
        _logger = logger;

        _logger.LogInformation("AI Agent base URL configured: {BaseUrl}", _http.BaseAddress);
    }

    public async Task<AgentQuizResponse?> GenerateQuizQuestionAsync(string topicName, double targetIrtBeta, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null, IReadOnlyList<string>? existingQuestions = null)
    {
        try
        {
            var payload = new
            {
                topic_name = topicName,
                target_irt_beta = targetIrtBeta,
                allowed_document_ids = allowedDocumentIds,
                allowed_scopes = allowedScopes,
                existing_questions = existingQuestions ?? Array.Empty<string>()
            };
            var content = AgentHttpJson.CreateContent(payload);

            var response = await _http.PostAsync("/tutor/generate-question", content);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return AgentHttpJson.Deserialize<AgentQuizResponse>(json);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AI Agent unavailable for GenerateQuizQuestion (topic={Topic})", topicName);
            return null;
        }
    }

    public async Task<AgentNextActionResponse?> GetNextActionAsync(string studentId, string topicName, double? masteryProbability = null, double? irtTheta = null)
    {
        try
        {
            var query = $"/tutor/next-action?student_id={Uri.EscapeDataString(studentId)}&topic_name={Uri.EscapeDataString(topicName)}";
            if (masteryProbability.HasValue)
                query += $"&mastery_probability={masteryProbability.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)}";
            if (irtTheta.HasValue)
                query += $"&irt_theta={irtTheta.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)}";

            var response = await _http.GetAsync(query);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return AgentHttpJson.Deserialize<AgentNextActionResponse>(json);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AI Agent unavailable for GetNextAction (topic={Topic})", topicName);
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

    public async Task<string?> GetGraderExplanationAsync(string question, string correctAnswer, IReadOnlyList<AgentGraderOption>? options = null, List<string>? allowedDocumentIds = null, List<string>? allowedScopes = null)
    {
        try
        {
            var payload = new
            {
                question,
                correct_answer = correctAnswer,
                options = options ?? Array.Empty<AgentGraderOption>(),
                allowed_document_ids = allowedDocumentIds,
                allowed_scopes = allowedScopes
            };
            var content = AgentHttpJson.CreateContent(payload);
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
        string topicName, string? userPrompt, string? docUrl, int numQuestions, string difficulty,
        int numEasy = 0, int numMedium = 0, int numHard = 0, string? documentId = null,
        IReadOnlyList<string>? existingQuestions = null)
    {
        try
        {
            var totalRequested = numEasy + numMedium + numHard;
            if (totalRequested == 0)
                totalRequested = numQuestions;

            var timeoutSeconds = Math.Min(600, Math.Max(180, totalRequested * 45));
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));

            var payload = new
            {
                topic_name = topicName,
                user_prompt = userPrompt,
                doc_url = docUrl,
                document_id = documentId,
                num_questions = numQuestions,
                difficulty,
                num_easy = numEasy,
                num_medium = numMedium,
                num_hard = numHard,
                existing_questions = existingQuestions ?? Array.Empty<string>()
            };
            var content = AgentHttpJson.CreateContent(payload);

            var batchClient = _httpClientFactory.CreateClient(QuizBatchHttpClientName);
            var response = await batchClient.PostAsync("/tutor/generate-quiz", content, cts.Token);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(cts.Token);
                _logger.LogWarning(
                    "GenerateQuizBatch failed: status={Status} topic={Topic} body={Body}",
                    (int)response.StatusCode,
                    topicName,
                    errorBody
                );
                return null;
            }

            var json = await response.Content.ReadAsStringAsync(cts.Token);
            return AgentHttpJson.Deserialize<AgentQuizBatchResponse>(json);
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
            var content = AgentHttpJson.CreateContent(payload);
            var response = await _http.PostAsync("/tutor/chat", content);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return AgentHttpJson.Deserialize<AgentChatResponse>(json) ?? new AgentChatResponse { Answer = "Không thể kết nối AI" };
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
            var content = AgentHttpJson.CreateContent(payload);
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
            var content = AgentHttpJson.CreateContent(payload);
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
