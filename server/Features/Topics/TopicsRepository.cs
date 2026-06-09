using EduBoost.API.Features.Roadmap;
using EduBoost.API.Features.Topics.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Topics;

public interface ITopicsRepository
{
    Task<List<TopicDto>> GetByClassIdAsync(Guid classId);
    Task<TopicDto?> GetByIdAsync(Guid topicId);
    Task<TopicDto> CreateAsync(Guid classId, CreateTopicRequest request);
    Task<TopicDto?> UpdateAsync(Guid topicId, UpdateTopicRequest request);
    Task<bool> DeleteAsync(Guid topicId);
    Task<List<TopicDto>> AiEvaluateAsync(Guid classId);
    Task<TopicDto?> UpdateDifficultyAsync(Guid topicId, string difficulty);
    Task<TopicDto?> UpdateVisibilityAsync(Guid topicId, bool isVisible);
    Task<bool> BelongsToClassAsync(Guid topicId, Guid classId);
}

public class TopicsRepository(AppDbContext db, IAgentService agent, ILogger<TopicsRepository> logger, IRoadmapRepository roadmap) : ITopicsRepository
{
    public async Task<List<TopicDto>> GetByClassIdAsync(Guid classId)
    {
        return await db.Topics
            .Where(t => t.ClassId == classId)
            .OrderBy(t => t.CreatedAt)
            .Select(t => MapToDto(t, db.Questions.Count(q => q.Quiz.TopicId == t.Id)))
            .ToListAsync();
    }

    public async Task<TopicDto?> GetByIdAsync(Guid topicId)
    {
        var t = await db.Topics.FindAsync(topicId);
        if (t == null) return null;
        var qCount = await db.Questions.CountAsync(q => q.Quiz.TopicId == t.Id);
        return MapToDto(t, qCount);
    }

    public async Task<TopicDto> CreateAsync(Guid classId, CreateTopicRequest request)
    {
        var topic = new Topic
        {
            Id          = Guid.NewGuid(),
            ClassId     = classId,
            Name        = request.Name,
            Description = request.Description ?? "",
            Difficulty  = "medium",
            AiEvaluated = false,
            IsDocumentVisible = false,
            CreatedAt   = DateTime.UtcNow
        };

        db.Topics.Add(topic);
        await db.SaveChangesAsync();

        var enrolledStudents = await db.Enrollments
            .Where(e => e.ClassId == classId && e.EntryTestCompleted)
            .Select(e => e.StudentId)
            .ToListAsync();

        foreach (var studentId in enrolledStudents)
            await roadmap.EnsureClassTopicsSyncedAsync(classId, studentId);

        return MapToDto(topic, 0);
    }

    public async Task<TopicDto?> UpdateAsync(Guid topicId, UpdateTopicRequest request)
    {
        var topic = await db.Topics.FindAsync(topicId);
        if (topic == null) return null;

        if (request.Name        != null) topic.Name        = request.Name;
        if (request.Description != null) topic.Description = request.Description;

        await db.SaveChangesAsync();
        var qCount = await db.Questions.CountAsync(q => q.Quiz.TopicId == topic.Id);
        return MapToDto(topic, qCount);
    }

    public async Task<bool> DeleteAsync(Guid topicId)
    {
        var topic = await db.Topics.FindAsync(topicId);
        if (topic == null) return false;
        db.Topics.Remove(topic);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<TopicDto>> AiEvaluateAsync(Guid classId)
    {
        var topics = await db.Topics
            .Where(t => t.ClassId == classId)
            .ToListAsync();

        foreach (var t in topics)
        {
            var samples = await db.Questions
                .Where(q => q.Quiz.TopicId == t.Id)
                .OrderBy(q => q.OrderIndex)
                .Select(q => q.Text)
                .Take(5)
                .ToListAsync();

            var prompt =
                $"Đánh giá độ khó chủ đề học tiếng Anh.\n" +
                $"Tên chủ đề: {t.Name}\n" +
                $"Mô tả: {t.Description}\n" +
                $"Mẫu câu hỏi: {(samples.Count > 0 ? string.Join("; ", samples) : "chưa có")}\n" +
                "Trả lời CHỈ MỘT từ: easy, medium, hoặc hard.";

            string difficulty;
            try
            {
                var aiResponse = await agent.AskAsync(prompt, t.Id.ToString(), "advanced", []);
                var parsed = TopicDifficultyParser.ParseFromAiResponse(aiResponse.Answer);
                if (parsed == null)
                {
                    difficulty = TopicDifficultyParser.HeuristicFromQuestionCount(samples.Count);
                    logger.LogWarning("AI evaluate fallback for topic {Topic}: agent offline or unparseable response", t.Name);
                }
                else
                {
                    difficulty = parsed;
                }
            }
            catch (Exception ex)
            {
                difficulty = TopicDifficultyParser.HeuristicFromQuestionCount(samples.Count);
                logger.LogWarning(ex, "AI evaluate failed for topic {Topic}: using heuristic", t.Name);
            }

            t.AiEvaluated = true;
            t.Difficulty = difficulty;
        }

        await db.SaveChangesAsync();
        return await GetByClassIdAsync(classId);
    }

    public async Task<TopicDto?> UpdateDifficultyAsync(Guid topicId, string difficulty)
    {
        var topic = await db.Topics.FindAsync(topicId);
        if (topic == null) return null;
        topic.Difficulty = difficulty;
        await db.SaveChangesAsync();
        var qCount = await db.Questions.CountAsync(q => q.Quiz.TopicId == topic.Id);
        return MapToDto(topic, qCount);
    }

    public async Task<TopicDto?> UpdateVisibilityAsync(Guid topicId, bool isVisible)
    {
        var topic = await db.Topics.FindAsync(topicId);
        if (topic == null) return null;
        topic.IsDocumentVisible = isVisible;
        await db.SaveChangesAsync();
        var qCount = await db.Questions.CountAsync(q => q.Quiz.TopicId == topic.Id);
        return MapToDto(topic, qCount);
    }

    public async Task<bool> BelongsToClassAsync(Guid topicId, Guid classId)
    {
        var topic = await db.Topics.AsNoTracking().FirstOrDefaultAsync(t => t.Id == topicId);
        return topic?.ClassId == classId;
    }

    private static TopicDto MapToDto(Topic t, int questionCount) => new()
    {
        Id               = t.Id.ToString(),
        ClassId          = t.ClassId?.ToString() ?? "",
        Name             = t.Name,
        Description      = t.Description,
        Difficulty       = t.Difficulty,
        AiEvaluated      = t.AiEvaluated,
        QuestionCount    = questionCount,
        IsDocumentVisible = t.IsDocumentVisible,
        CreatedAt        = t.CreatedAt.ToString("yyyy-MM-dd")
    };
}
