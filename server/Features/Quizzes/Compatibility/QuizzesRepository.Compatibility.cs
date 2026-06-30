using System.Text.Json;
using EduBoost.API.Features.LearningStates;
using EduBoost.API.Features.Roadmap;
using EduBoost.API.Features.LearningStates.Models;
using EduBoost.API.Features.Quizzes.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace EduBoost.API.Features.Quizzes;

public partial class QuizzesRepository
{
    public async Task<EntryTestDto?> GetEntryTestAsync(Guid classId)
    {
        var quiz = await db.Quizzes
            .Include(q => q.Questions).ThenInclude(q => q.Options)
            .Include(q => q.Questions).ThenInclude(q => q.IrtItem)
            .FirstOrDefaultAsync(q => q.ClassId == classId && q.Type == "entry_test" && q.IsPublished);

        if (quiz == null) return null;

        var cls = await db.Classes.FindAsync(classId);

        return new EntryTestDto
        {
            QuizId = quiz.Id.ToString(),
            ClassId = classId.ToString(),
            ClassName = cls?.Name ?? "",
            Questions = quiz.Questions.OrderBy(q => q.OrderIndex).Select(QuestionMapper.ToDto).ToList()
        };
    }

    public async Task<QuizResultDto> SubmitEntryTestAsync(Guid classId, Guid studentId, SubmitQuizRequest request)
    {
        var quiz = await db.Quizzes
            .Include(q => q.Questions).ThenInclude(q => q.Options)
            .FirstOrDefaultAsync(q => q.ClassId == classId && q.Type == "entry_test");

        var result = await ScoreAndSaveAsync(quiz, studentId, request);

        // Mark entry test as completed on the enrollment
        var enrollment = await db.Enrollments
            .FirstOrDefaultAsync(e => e.StudentId == studentId && e.ClassId == classId);
        if (enrollment != null && !enrollment.EntryTestCompleted)
        {
            enrollment.EntryTestCompleted = true;
            await db.SaveChangesAsync();
        }

        await roadmap.GenerateAsync(classId, studentId, entryTestResultId: string.Empty);

        return result;
    }

    public async Task<bool> HasEntryTestAsync(Guid classId)
    {
        return await db.Quizzes.AnyAsync(q => q.ClassId == classId && q.Type == "entry_test");
    }

    public async Task<QuizDto> GenerateEntryTestAsync(Guid classId)
    {
        var cls = await db.Classes.FindAsync(classId);
        var topics = await db.Topics
            .Where(t => t.ClassId == classId)
            .OrderBy(t => t.Difficulty == "easy" ? 0 : t.Difficulty == "medium" ? 1 : 2)
            .ThenBy(t => t.CreatedAt)
            .ToListAsync();

        var questions = new List<Question>();
        int order = 0;

        foreach (var topic in topics)
        {
            int count = topic.Difficulty == "easy" ? 2 : topic.Difficulty == "hard" ? 3 : 2;
            var aiResponse = await agent.GenerateQuizBatchAsync(
                topic.Name,
                userPrompt: $"Generate placement/entry test questions for topic \"{topic.Name}\".",
                docUrl: null,
                numQuestions: count,
                difficulty: topic.Difficulty);

            var aiQuestions = aiResponse?.Questions is { Count: > 0 }
                ? AgentQuizValidation.FilterQuestionsWithSingleCorrectOption(aiResponse.Questions, logger)
                : [];

            if (aiQuestions.Count > 0)
            {
                foreach (var aiQ in aiQuestions)
                {
                    var entity = MapAgentQuestionToEntity(aiQ, order++);
                    entity.SourceTopicId = topic.Id;
                    questions.Add(entity);
                }
                continue;
            }

            logger.LogWarning("AI unavailable for entry test topic {Topic} — using placeholder questions", topic.Name);
            for (int i = 0; i < count; i++)
            {
                var placeholder = CreatePlaceholderQuestion(topic.Name, topic.Difficulty, order++, i + 1);
                placeholder.SourceTopicId = topic.Id;
                questions.Add(placeholder);
            }
        }

        if (questions.Count == 0)
        {
            questions.Add(CreatePlaceholderQuestion(cls?.Name ?? "Lớp học", "medium", 0, 1));
        }

        var quiz = new Quiz
        {
            Id = Guid.NewGuid(),
            Title = $"Bài test đầu vào — {cls?.Name ?? "Lớp học"}",
            Type = "entry_test",
            ClassId = classId,
            IsPublished = false,
            CreatedAt = DateTime.UtcNow,
            Questions = questions,
        };

        db.Quizzes.Add(quiz);
        await db.SaveChangesAsync();

        return new QuizDto
        {
            Id = quiz.Id.ToString(),
            ClassId = classId.ToString(),
            Title = quiz.Title,
            Type = quiz.Type,
            IsPublished = quiz.IsPublished,
            QuestionCount = quiz.Questions.Count,
            CreatedAt = quiz.CreatedAt.ToString("o"),
        };
    }

}
