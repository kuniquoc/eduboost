using EduBoost.API.Features.Classes;
using EduBoost.API.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.QuizPool;

public interface IPoolAuthorization
{
    Task<bool> CanAccessTopicAsync(Guid userId, string userRole, Guid topicId);
    Task<bool> CanAccessPoolQuizzesAsync(Guid userId, string userRole, IEnumerable<Guid> poolQuizIds);
}

public class PoolAuthorization(AppDbContext db, IClassesRepository classes) : IPoolAuthorization
{
    public async Task<bool> CanAccessTopicAsync(Guid userId, string userRole, Guid topicId)
    {
        var topic = await db.Topics.AsNoTracking().FirstOrDefaultAsync(t => t.Id == topicId);
        if (topic == null) return false;
        if (topic.OwnerId == userId) return true;
        if (!topic.ClassId.HasValue) return false;

        return userRole == "teacher"
            ? await classes.IsOwnedByTeacherAsync(topic.ClassId.Value, userId)
            : await classes.IsStudentEnrolledAsync(topic.ClassId.Value, userId);
    }

    public async Task<bool> CanAccessPoolQuizzesAsync(Guid userId, string userRole, IEnumerable<Guid> poolQuizIds)
    {
        var ids = poolQuizIds.ToList();
        if (ids.Count == 0) return false;

        var quizzes = await db.Quizzes.AsNoTracking()
            .Where(q => ids.Contains(q.Id) && q.Type == "pool")
            .Select(q => new { q.Id, q.TopicId })
            .ToListAsync();

        if (quizzes.Count != ids.Count) return false;

        var topicIds = quizzes
            .Where(q => q.TopicId.HasValue)
            .Select(q => q.TopicId!.Value)
            .Distinct();

        foreach (var topicId in topicIds)
        {
            if (!await CanAccessTopicAsync(userId, userRole, topicId))
                return false;
        }

        return true;
    }
}
