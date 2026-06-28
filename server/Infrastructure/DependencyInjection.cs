using EduBoost.API.Features.Admin;
using EduBoost.API.Features.AiChat;
using EduBoost.API.Features.Auth;
using EduBoost.API.Features.Classes;
using EduBoost.API.Features.Documents;
using EduBoost.API.Features.LearningStates;
using EduBoost.API.Features.PlacementTests;
using EduBoost.API.Features.PracticeSessions;
using EduBoost.API.Features.QuizPool;
using EduBoost.API.Features.Quizzes;
using EduBoost.API.Features.Roadmap;
using EduBoost.API.Features.Students;
using EduBoost.API.Features.Topics;
using EduBoost.API.Features.UserProfiles;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;

namespace EduBoost.API.Infrastructure;

internal static class DependencyInjection
{
    public static IServiceCollection AddEduBoostFeatures(this IServiceCollection services)
    {
        services.AddSingleton<ITutorDecisionService, TutorDecisionService>();
        services.AddScoped<IStudentStatsCalculator, StudentStatsCalculator>();

        services.AddSingleton<DocumentIngestQueue>();
        services.AddSingleton<IDocumentIngestQueue>(provider => provider.GetRequiredService<DocumentIngestQueue>());
        services.AddHostedService<DocumentIngestBackgroundService>();

        services.AddScoped<IAuthRepository, AuthRepository>();
        services.AddScoped<IClassesRepository, ClassesRepository>();
        services.AddScoped<ITopicsRepository, TopicsRepository>();
        services.AddScoped<IDocumentsRepository, DocumentsRepository>();
        services.AddScoped<IQuizAuthorization, QuizAuthorization>();
        services.AddScoped<IQuizzesRepository, QuizzesRepository>();
        services.AddScoped<IStudentsRepository, StudentsRepository>();
        services.AddScoped<IRoadmapRepository, RoadmapRepository>();
        services.AddScoped<IPoolRepository, PoolRepository>();
        services.AddScoped<IPoolAuthorization, PoolAuthorization>();
        services.AddScoped<IUserProfilesRepository, UserProfilesRepository>();
        services.AddScoped<ILearningStatesRepository, LearningStatesRepository>();
        services.AddScoped<IPlacementTestsRepository, PlacementTestsRepository>();
        services.AddScoped<IPracticeSessionsRepository, PracticeSessionsRepository>();
        services.AddScoped<IAiChatRepository, AiChatRepository>();
        services.AddScoped<IAdminRepository, AdminRepository>();
        return services;
    }

    public static IServiceCollection AddAgentIntegration(this IServiceCollection services)
    {
        services.AddHttpClient<IAgentService, AgentService>((provider, client) =>
            ConfigureAgentClient(provider, client, timeoutSeconds: 120));
        services.AddHttpClient(AgentService.QuizBatchHttpClientName, (provider, client) =>
            ConfigureAgentClient(provider, client, timeoutSeconds: 600));
        return services;
    }

    private static void ConfigureAgentClient(IServiceProvider provider, HttpClient client, int timeoutSeconds)
    {
        var configuration = provider.GetRequiredService<IConfiguration>();
        var baseUrl = configuration["AIAgent:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
            baseUrl = "http://host.docker.internal:8000";
        else if (!baseUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                 && !baseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            baseUrl = $"http://{baseUrl}";

        client.BaseAddress = new Uri(baseUrl);
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
    }
}
