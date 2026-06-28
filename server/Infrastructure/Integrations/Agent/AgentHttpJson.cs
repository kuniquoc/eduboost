using System.Text;
using System.Text.Json;

namespace EduBoost.API.Infrastructure.Integrations.Agent;

internal static class AgentHttpJson
{
    private static readonly JsonSerializerOptions SerializeOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    private static readonly JsonSerializerOptions DeserializeOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static StringContent CreateContent<T>(T payload) => new(
        JsonSerializer.Serialize(payload, SerializeOptions),
        Encoding.UTF8,
        "application/json");

    public static T? Deserialize<T>(string json) =>
        JsonSerializer.Deserialize<T>(json, DeserializeOptions);
}
