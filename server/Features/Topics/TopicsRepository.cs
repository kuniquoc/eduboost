using EduBoost.API.Features.Roadmap;
using EduBoost.API.Features.Topics.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Topics;

public interface ITopicsRepository
{
    Task<List<TopicDto>> GetByClassIdAsync(Guid classId);
    Task<TopicDto?> GetByIdAsync(Guid topicId);
    Task<TopicDto> CreateAsync(Guid classId, CreateTopicRequest request);
    Task<TopicDto?> UpdateAsync(Guid topicId, UpdateTopicRequest request);
    Task<bool> DeleteAsync(Guid topicId);
    Task<TopicDto?> UpdateDifficultyAsync(Guid topicId, string difficulty);
    Task<TopicDto?> UpdateVisibilityAsync(Guid topicId, bool isVisible);
    Task<bool> BelongsToClassAsync(Guid topicId, Guid classId);
}

public class TopicsRepository(AppDbContext db, IRoadmapRepository roadmap) : ITopicsRepository
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
            Id = Guid.NewGuid(),
            ClassId = classId,
            Name = request.Name,
            Description = request.Description ?? "",
            Difficulty = "medium",
            AiEvaluated = false,
            IsDocumentVisible = false,
            CreatedAt = DateTime.UtcNow
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

        if (request.Name != null) topic.Name = request.Name;
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
        Id = t.Id.ToString(),
        ClassId = t.ClassId?.ToString() ?? "",
        Name = t.Name,
        Description = t.Description,
        Difficulty = t.Difficulty,
        AiEvaluated = t.AiEvaluated,
        QuestionCount = questionCount,
        IsDocumentVisible = t.IsDocumentVisible,
        CreatedAt = t.CreatedAt.ToString("yyyy-MM-dd")
    };
}
