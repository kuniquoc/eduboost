using EduBoost.API.Features.Classes;
using EduBoost.API.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Quizzes;

public interface IQuizAuthorization
{
    Task<Guid?> GetQuizClassIdAsync(Guid quizId);
    Task<bool> CanTeacherManageQuizAsync(Guid quizId, Guid teacherId);
    Task<bool> CanStudentAccessPrivateQuizAsync(Guid quizId, Guid studentId);
    Task<bool> CanStudentAccessTopicAsync(Guid topicId, Guid studentId);
    Task<bool> CanStudentAccessFixedQuestionsAsync(IEnumerable<Guid> questionIds, Guid studentId);
    Task<bool> CanStudentAccessClassQuizAsync(Guid quizId, Guid studentId);
    Task<bool> QuestionBelongsToQuizAsync(Guid quizId, Guid questionId);
}

public class QuizAuthorization(AppDbContext db, IClassesRepository classes) : IQuizAuthorization
{
    public async Task<Guid?> GetQuizClassIdAsync(Guid quizId)
    {
        var quiz = await db.Quizzes.AsNoTracking().FirstOrDefaultAsync(q => q.Id == quizId);
        if (quiz == null) return null;
        if (quiz.ClassId.HasValue) return quiz.ClassId;
        if (quiz.TopicId.HasValue)
        {
            var topic = await db.Topics.AsNoTracking().FirstOrDefaultAsync(t => t.Id == quiz.TopicId);
            return topic?.ClassId;
        }
        return null;
    }

    public async Task<bool> CanTeacherManageQuizAsync(Guid quizId, Guid teacherId)
    {
        var classId = await GetQuizClassIdAsync(quizId);
        if (!classId.HasValue) return false;
        return await classes.IsOwnedByTeacherAsync(classId.Value, teacherId);
    }

    public async Task<bool> CanStudentAccessPrivateQuizAsync(Guid quizId, Guid studentId)
    {
        var quiz = await db.Quizzes.AsNoTracking().FirstOrDefaultAsync(q => q.Id == quizId);
        if (quiz == null) return false;
        return quiz.OwnerId == studentId;
    }

    public async Task<bool> CanStudentAccessTopicAsync(Guid topicId, Guid studentId)
    {
        var topic = await db.Topics.AsNoTracking().FirstOrDefaultAsync(t => t.Id == topicId);
        if (topic == null) return false;
        if (topic.ClassId == null) return topic.OwnerId == studentId;
        return await classes.IsStudentEnrolledAsync(topic.ClassId.Value, studentId);
    }

    public async Task<bool> CanStudentAccessFixedQuestionsAsync(IEnumerable<Guid> questionIds, Guid studentId)
    {
        var ids = questionIds.ToHashSet();
        if (ids.Count == 0) return false;

        var questions = await db.Questions.AsNoTracking()
            .Include(q => q.Quiz)
            .Where(q => ids.Contains(q.Id))
            .ToListAsync();

        if (questions.Count != ids.Count) return false;

        foreach (var q in questions)
        {
            if (q.Quiz?.OwnerId == studentId && q.Quiz.Type == "private")
                continue;

            var topicId = q.SourceTopicId ?? q.Quiz?.TopicId;
            if (topicId.HasValue && await CanStudentAccessTopicAsync(topicId.Value, studentId))
                continue;

            return false;
        }

        return true;
    }

    public async Task<bool> CanStudentAccessClassQuizAsync(Guid quizId, Guid studentId)
    {
        var quiz = await db.Quizzes.AsNoTracking().FirstOrDefaultAsync(q => q.Id == quizId);
        if (quiz == null) return false;
        // Allow both "practice" and "pool" types — pool quizzes published to a class
        // are visible to students (new publishes are promoted to "practice" at publish
        // time, but existing published pool quizzes in the DB must also be accessible).
        var isClassQuizType = quiz.Type is "practice" or "pool";
        if (!isClassQuizType || !quiz.IsPublished || !quiz.ClassId.HasValue) return false;
        return await classes.IsStudentEnrolledAsync(quiz.ClassId.Value, studentId);
    }

    public Task<bool> QuestionBelongsToQuizAsync(Guid quizId, Guid questionId) =>
        db.Questions.AsNoTracking().AnyAsync(q => q.Id == questionId && q.QuizId == quizId);
}
