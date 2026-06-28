using System.Text.Json.Serialization;

namespace EduBoost.API.Infrastructure.Integrations.Agent;

public class AgentGraderOption
{
    public string Id { get; set; } = "";
    public string Text { get; set; } = "";
}

public class AgentNextActionResponse
{
    public string Action { get; set; } = "";
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

    [JsonPropertyName("correct_answer")]
    public string CorrectAnswer { get; set; } = "";

    public string Explanation { get; set; } = "";

    [JsonPropertyName("difficulty_level")]
    public double DifficultyLevel { get; set; }
}

public class AgentQuizBatchOption
{
    public string Text { get; set; } = "";

    [JsonPropertyName("isCorrect")]
    public bool IsCorrect { get; set; }
}

public class AgentQuizBatchQuestion
{
    public string Question { get; set; } = "";
    public string Type { get; set; } = "mcq";
    public string Difficulty { get; set; } = "medium";

    [JsonPropertyName("difficulty_index")]
    public double? DifficultyIndex { get; set; }

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
    [JsonPropertyName("document_id")]
    public string DocumentId { get; set; } = "";

    [JsonPropertyName("file_name")]
    public string FileName { get; set; } = "";

    public string? Snippet { get; set; }
}
