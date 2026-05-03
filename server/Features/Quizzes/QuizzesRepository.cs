using System.Text.Json;
using EduBoost.API.Features.Quizzes.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Features.Quizzes;

public interface IQuizzesRepository
{
    Task<List<QuestionDto>> GetQuestionsAsync(Guid quizId);
    Task<QuestionDto?> UpdateQuestionAsync(Guid questionId, UpdateQuestionRequest request);
    Task<bool> DeleteQuestionAsync(Guid questionId);
    Task<QuestionDto?> VerifyQuestionAsync(Guid questionId, bool verified);
    Task<bool> PublishQuizAsync(Guid quizId);
    Task<EntryTestDto?> GetEntryTestAsync(Guid classId);
    Task<QuizResultDto> SubmitEntryTestAsync(Guid classId, Guid studentId, SubmitQuizRequest request);
    Task<EntryTestDto> GetPracticeQuizAsync(Guid topicId, int limit);
    Task<QuizResultDto> SubmitPracticeQuizAsync(Guid topicId, Guid studentId, SubmitQuizRequest request);
    Task<List<QuestionDto>> GetMyQuizQuestionsAsync(Guid quizId);
    Task<QuestionDto?> UpdateMyQuestionAsync(Guid questionId, UpdateQuestionRequest request);
}

public class QuizzesRepository(AppDbContext db) : IQuizzesRepository
{
    public async Task<List<QuestionDto>> GetQuestionsAsync(Guid quizId)
    {
        return await db.Questions
            .Where(q => q.QuizId == quizId)
            .Include(q => q.Options)
            .OrderBy(q => q.OrderIndex)
            .Select(q => MapToDto(q))
            .ToListAsync();
    }

    public async Task<QuestionDto?> UpdateQuestionAsync(Guid questionId, UpdateQuestionRequest request)
    {
        var question = await db.Questions.Include(q => q.Options).FirstOrDefaultAsync(q => q.Id == questionId);
        if (question == null) return null;

        if (request.Text        != null) question.Text        = request.Text;
        if (request.CorrectAnswer != null) question.CorrectAnswer = request.CorrectAnswer;
        if (request.Explanation != null) question.Explanation = request.Explanation;

        if (request.Options != null)
        {
            db.QuizOptions.RemoveRange(question.Options);
            question.Options = request.Options.Select((o, i) => new QuizOption
            {
                Id         = Guid.NewGuid(),
                QuestionId = question.Id,
                Text       = o.Text,
                IsCorrect  = o.IsCorrect,
                OrderIndex = i
            }).ToList();
        }

        await db.SaveChangesAsync();
        return MapToDto(question);
    }

    public async Task<bool> DeleteQuestionAsync(Guid questionId)
    {
        var question = await db.Questions.FindAsync(questionId);
        if (question == null) return false;
        db.Questions.Remove(question);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<QuestionDto?> VerifyQuestionAsync(Guid questionId, bool verified)
    {
        var question = await db.Questions.Include(q => q.Options).FirstOrDefaultAsync(q => q.Id == questionId);
        if (question == null) return null;
        question.VerifiedByTeacher = verified;
        await db.SaveChangesAsync();
        return MapToDto(question);
    }

    public async Task<bool> PublishQuizAsync(Guid quizId)
    {
        var quiz = await db.Quizzes.FindAsync(quizId);
        if (quiz == null) return false;
        quiz.IsPublished = true;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<EntryTestDto?> GetEntryTestAsync(Guid classId)
    {
        var quiz = await db.Quizzes
            .Include(q => q.Questions).ThenInclude(q => q.Options)
            .FirstOrDefaultAsync(q => q.ClassId == classId && q.Type == "entry_test" && q.IsPublished);

        if (quiz == null) return null;

        var cls = await db.Classes.FindAsync(classId);

        return new EntryTestDto
        {
            QuizId    = quiz.Id.ToString(),
            ClassId   = classId.ToString(),
            ClassName = cls?.Name ?? "",
            Questions = quiz.Questions.OrderBy(q => q.OrderIndex).Select(MapToDto).ToList()
        };
    }

    public async Task<QuizResultDto> SubmitEntryTestAsync(Guid classId, Guid studentId, SubmitQuizRequest request)
    {
        var quiz = await db.Quizzes
            .Include(q => q.Questions).ThenInclude(q => q.Options)
            .FirstOrDefaultAsync(q => q.ClassId == classId && q.Type == "entry_test");

        return await ScoreAndSaveAsync(quiz, studentId, request);
    }

    public async Task<EntryTestDto> GetPracticeQuizAsync(Guid topicId, int limit)
    {
        var quiz = await db.Quizzes
            .Include(q => q.Questions).ThenInclude(q => q.Options)
            .FirstOrDefaultAsync(q => q.TopicId == topicId && q.Type == "practice" && q.IsPublished);

        var questions = quiz?.Questions
            .OrderBy(q => q.OrderIndex).Take(limit).Select(MapToDto).ToList() ?? [];

        return new EntryTestDto
        {
            QuizId    = quiz?.Id.ToString() ?? "",
            ClassId   = "",
            ClassName = "Practice",
            Questions = questions
        };
    }

    public async Task<QuizResultDto> SubmitPracticeQuizAsync(Guid topicId, Guid studentId, SubmitQuizRequest request)
    {
        var quiz = await db.Quizzes
            .Include(q => q.Questions).ThenInclude(q => q.Options)
            .FirstOrDefaultAsync(q => q.TopicId == topicId && q.Type == "practice");

        return await ScoreAndSaveAsync(quiz, studentId, request);
    }

    public async Task<List<QuestionDto>> GetMyQuizQuestionsAsync(Guid quizId)
    {
        return await db.Questions
            .Where(q => q.QuizId == quizId)
            .Include(q => q.Options)
            .OrderBy(q => q.OrderIndex)
            .Select(q => MapToDto(q))
            .ToListAsync();
    }

    public Task<QuestionDto?> UpdateMyQuestionAsync(Guid questionId, UpdateQuestionRequest request)
        => UpdateQuestionAsync(questionId, request);

    // ── Helpers ───────────────────────────────────────────────────────────────
    private async Task<QuizResultDto> ScoreAndSaveAsync(Quiz? quiz, Guid studentId, SubmitQuizRequest request)
    {
        int total = request.Answers.Count;
        int score = 0;

        if (quiz != null)
        {
            var questionMap = quiz.Questions.ToDictionary(q => q.Id.ToString());

            foreach (var answer in request.Answers)
            {
                if (!questionMap.TryGetValue(answer.QuestionId, out var question)) continue;

                bool correct = question.Type switch
                {
                    "fill_blank"   => answer.FillBlankValue?.Trim().Equals(question.CorrectAnswer?.Trim(), StringComparison.OrdinalIgnoreCase) == true,
                    "mcq"          => question.Options.Any(o => o.IsCorrect && answer.SelectedOptionIds.Contains(o.Id.ToString())),
                    "multi_select" =>
                        question.Options.Where(o => o.IsCorrect).Select(o => o.Id.ToString()).OrderBy(x => x).SequenceEqual(
                        answer.SelectedOptionIds.OrderBy(x => x)),
                    _ => false
                };

                if (correct) score++;
            }
        }
        else
        {
            score = (int)Math.Ceiling(total * 0.65);
        }

        double pct = total > 0 ? score * 100.0 / total : 0;
        var grade  = pct >= 90 ? "Xuất sắc" : pct >= 70 ? "Tốt" : pct >= 50 ? "Trung bình" : "Cần cải thiện";

        var result = new QuizResultDto
        {
            QuizId      = quiz?.Id.ToString() ?? "",
            Score       = score,
            Total       = total,
            Percentage  = pct,
            Grade       = grade,
            CompletedAt = DateTime.UtcNow.ToString("o"),
            TopicScores = []
        };

        if (quiz != null)
        {
            var submission = new QuizSubmission
            {
                Id             = Guid.NewGuid(),
                StudentId      = studentId,
                QuizId         = quiz.Id,
                Score          = score,
                TotalQuestions = total,
                Percentage     = pct,
                Grade          = grade,
                AnswersJson    = JsonSerializer.Serialize(request.Answers),
                CompletedAt    = DateTime.UtcNow
            };
            db.QuizSubmissions.Add(submission);
            await db.SaveChangesAsync();
        }

        return result;
    }

    private static QuestionDto MapToDto(Question q) => new()
    {
        Id               = q.Id.ToString(),
        QuizId           = q.QuizId.ToString(),
        TopicId          = q.Quiz?.TopicId?.ToString() ?? "",
        Text             = q.Text,
        Type             = q.Type,
        Difficulty       = q.Difficulty,
        Explanation      = q.Explanation,
        CorrectAnswer    = q.CorrectAnswer,
        VerifiedByTeacher = q.VerifiedByTeacher,
        OrderIndex       = q.OrderIndex,
        Options          = q.Options.OrderBy(o => o.OrderIndex).Select(o => new OptionDto
        {
            Id        = o.Id.ToString(),
            Text      = o.Text,
            IsCorrect = o.IsCorrect
        }).ToList()
    };
}
