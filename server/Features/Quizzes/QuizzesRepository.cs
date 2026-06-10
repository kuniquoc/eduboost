using System.Text.Json;
using EduBoost.API.Features.LearningStates;
using EduBoost.API.Features.Roadmap;
using EduBoost.API.Features.LearningStates.Models;
using EduBoost.API.Features.Quizzes.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace EduBoost.API.Features.Quizzes;

public interface IQuizzesRepository
{
    Task<QuizDto?> GetQuizByIdAsync(Guid quizId);
    Task<List<QuestionDto>> GetQuestionsAsync(Guid quizId);
    Task<QuestionDto?> UpdateQuestionAsync(Guid questionId, UpdateQuestionRequest request);
    Task<bool> DeleteQuestionAsync(Guid questionId);
    Task<bool> DeleteQuizAsync(Guid quizId, Guid userId);
    Task<QuestionDto?> VerifyQuestionAsync(Guid questionId, bool verified);
    Task<bool> PublishQuizAsync(Guid quizId);
    Task<EntryTestDto?> GetEntryTestAsync(Guid classId);
    Task<QuizResultDto> SubmitEntryTestAsync(Guid classId, Guid studentId, SubmitQuizRequest request);
    Task<EntryTestDto> GetPracticeQuizAsync(Guid topicId, int limit);
    Task<QuizResultDto> SubmitPracticeQuizAsync(Guid topicId, Guid studentId, SubmitQuizRequest request);
    Task<List<QuestionDto>> GetMyQuizQuestionsAsync(Guid quizId);
    Task<QuestionDto?> UpdateMyQuestionAsync(Guid questionId, UpdateQuestionRequest request);
    Task<QuizDto> CreateQuizAsync(CreateQuizRequest request, string type);
    Task<QuizDto> CreatePrivateQuizAsync(Guid ownerId, CreateQuizRequest request);
    Task<List<QuizDto>> GetClassQuizzesAsync(Guid classId);
    Task<bool> HasEntryTestAsync(Guid classId);
    Task<QuizDto> GenerateEntryTestAsync(Guid classId);
    Task<QuestionDto?> AddQuestionAsync(Guid quizId, CreateQuestionRequest request);
    Task<List<QuestionDto>> AddQuestionsFromPoolAsync(Guid quizId, List<Guid> questionIds, Guid teacherId);
    Task<string?> GetTopicNameAsync(Guid topicId);
    Task<Guid?> GetTopicClassIdAsync(Guid topicId);
    Task<List<string>> GetRecentTutorQuestionTextsAsync(Guid topicId, int limit = 150);
    Task<Guid> PersistTutorQuestionAsync(Guid topicId, AgentQuizResponse agentQuestion);
    Task<QuestionDto?> GetTutorQuestionAsync(Guid topicId, Guid questionId);
    Task CompleteTutorPracticeAsync(Guid userId, Guid topicId, int questionsAttempted, int correctAnswers);
}

public class QuizzesRepository(AppDbContext db, IAgentService agent, ILearningStatesRepository learningStates, IRoadmapRepository roadmap, ILogger<QuizzesRepository> logger) : IQuizzesRepository
{
    public async Task<QuizDto?> GetQuizByIdAsync(Guid quizId)
    {
        var quiz = await db.Quizzes
            .Include(q => q.Questions)
            .FirstOrDefaultAsync(q => q.Id == quizId);
        if (quiz == null) return null;
        return new QuizDto
        {
            Id = quiz.Id.ToString(),
            ClassId = quiz.ClassId?.ToString() ?? "",
            TopicId = quiz.TopicId?.ToString(),
            Title = quiz.Title,
            Type = quiz.Type,
            IsPublished = quiz.IsPublished,
            QuestionCount = quiz.Questions.Count,
            CreatedAt = quiz.CreatedAt.ToString("o")
        };
    }

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

        if (request.Text != null) question.Text = request.Text;
        if (request.CorrectAnswer != null) question.CorrectAnswer = request.CorrectAnswer;
        if (request.Explanation != null) question.Explanation = request.Explanation;

        if (request.Options != null)
        {
            // 1. Delete options not in the request using ExecuteDeleteAsync to bypass
            //    EF's optimistic-concurrency row-count check (avoids DbUpdateConcurrencyException
            //    when options were deleted by a concurrent request or between loads).
            var requestIds = request.Options
                .Where(o => !string.IsNullOrEmpty(o.Id) && Guid.TryParse(o.Id, out _))
                .Select(o => Guid.Parse(o.Id))
                .ToHashSet();

            var idsToDelete = question.Options
                .Where(o => !requestIds.Contains(o.Id))
                .Select(o => o.Id)
                .ToList();

            if (idsToDelete.Count > 0)
            {
                // Direct SQL DELETE — no optimistic-concurrency check, no stale-tracking issue.
                await db.QuizOptions
                    .Where(o => idsToDelete.Contains(o.Id))
                    .ExecuteDeleteAsync();

                // Remove deleted options from the in-memory collection so subsequent
                // navigation-property lookups see a consistent state.
                foreach (var id in idsToDelete)
                {
                    var tracked = question.Options.FirstOrDefault(o => o.Id == id);
                    if (tracked != null) question.Options.Remove(tracked);
                }
            }

            // 2. Update existing options or add new ones
            for (int i = 0; i < request.Options.Count; i++)
            {
                var reqOpt = request.Options[i];
                if (!string.IsNullOrEmpty(reqOpt.Id) && Guid.TryParse(reqOpt.Id, out var optId))
                {
                    var existingOpt = question.Options.FirstOrDefault(o => o.Id == optId);
                    if (existingOpt != null)
                    {
                        existingOpt.Text = reqOpt.Text;
                        existingOpt.IsCorrect = reqOpt.IsCorrect;
                        existingOpt.OrderIndex = i;
                    }
                    else
                    {
                        question.Options.Add(new QuizOption
                        {
                            Id = optId,
                            QuestionId = question.Id,
                            Text = reqOpt.Text,
                            IsCorrect = reqOpt.IsCorrect,
                            OrderIndex = i
                        });
                    }
                }
                else
                {
                    question.Options.Add(new QuizOption
                    {
                        Id = Guid.NewGuid(),
                        QuestionId = question.Id,
                        Text = reqOpt.Text,
                        IsCorrect = reqOpt.IsCorrect,
                        OrderIndex = i
                    });
                }
            }

            if (request.Options.Count > 0)
            {
                // Automatically synchronize the CorrectAnswer property of the question
                question.CorrectAnswer = request.Options.FirstOrDefault(o => o.IsCorrect)?.Text ?? "";
            }
        }

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException ex)
        {
            // Another request modified/deleted this question concurrently.
            // Reload from DB and retry the save so the caller always gets a fresh result.
            foreach (EntityEntry entry in ex.Entries)
                await entry.ReloadAsync();

            await db.SaveChangesAsync();
        }

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

    public async Task<bool> DeleteQuizAsync(Guid quizId, Guid userId)
    {
        var quiz = await db.Quizzes.FindAsync(quizId);
        if (quiz == null) return false;

        // Only the owner or the class teacher may delete
        if (quiz.OwnerId.HasValue && quiz.OwnerId != userId) return false;
        if (quiz.ClassId.HasValue && !quiz.OwnerId.HasValue)
        {
            var isTeacher = await db.Classes.AnyAsync(c => c.Id == quiz.ClassId && c.TeacherId == userId);
            if (!isTeacher) return false;
        }

        // If this quiz is the active entry test for the class, clear that reference first
        if (quiz.ClassId.HasValue)
        {
            var cls = await db.Classes.FirstOrDefaultAsync(c => c.Id == quiz.ClassId && c.ActiveEntryTestId == quizId);
            if (cls != null) cls.ActiveEntryTestId = null;
        }

        db.Quizzes.Remove(quiz);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<QuestionDto>> AddQuestionsFromPoolAsync(Guid quizId, List<Guid> questionIds, Guid teacherId)
    {
        var quiz = await db.Quizzes.Include(q => q.Questions).FirstOrDefaultAsync(q => q.Id == quizId);
        if (quiz == null) return [];

        if (quiz.ClassId.HasValue)
        {
            var isTeacher = await db.Classes.AnyAsync(c => c.Id == quiz.ClassId && c.TeacherId == teacherId);
            if (!isTeacher) return [];
        }

        var poolQuestions = await db.Questions
            .Where(q => questionIds.Contains(q.Id) && q.Quiz.Type == "pool")
            .Include(q => q.Options)
            .Include(q => q.Quiz)
            .ToListAsync();

        var maxOrder = quiz.Questions.Count > 0 ? quiz.Questions.Max(q => q.OrderIndex) + 1 : 0;
        var added = new List<Question>();

        foreach (var (poolQ, idx) in poolQuestions.Select((q, i) => (q, i)))
        {
            var copy = new Question
            {
                Id = Guid.NewGuid(),
                QuizId = quizId,
                Text = poolQ.Text,
                Type = poolQ.Type,
                Difficulty = poolQ.Difficulty,
                Explanation = poolQ.Explanation,
                CorrectAnswer = poolQ.CorrectAnswer,
                VerifiedByTeacher = true,
                OrderIndex = maxOrder + idx,
                SourceTopicId = poolQ.Quiz?.TopicId,
                Options = poolQ.Options.Select((o, oi) => new QuizOption
                {
                    Id = Guid.NewGuid(),
                    Text = o.Text,
                    IsCorrect = o.IsCorrect,
                    OrderIndex = oi
                }).ToList()
            };
            db.Questions.Add(copy);
            added.Add(copy);
        }

        await db.SaveChangesAsync();
        return added.Select(MapToDto).ToList();
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
            QuizId = quiz.Id.ToString(),
            ClassId = classId.ToString(),
            ClassName = cls?.Name ?? "",
            Questions = quiz.Questions.OrderBy(q => q.OrderIndex).Select(MapToDto).ToList()
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

    public async Task<EntryTestDto> GetPracticeQuizAsync(Guid topicId, int limit)
    {
        var quiz = await db.Quizzes
            .Include(q => q.Questions).ThenInclude(q => q.Options)
            .FirstOrDefaultAsync(q => q.TopicId == topicId && q.Type == "practice" && q.IsPublished);

        var questions = quiz?.Questions
            .OrderBy(q => q.OrderIndex).Take(limit).Select(MapToDto).ToList() ?? [];

        return new EntryTestDto
        {
            QuizId = quiz?.Id.ToString() ?? "",
            ClassId = "",
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

    public async Task<QuizDto> CreateQuizAsync(CreateQuizRequest request, string type)
    {
        var quiz = new Quiz
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Type = type,
            ClassId = string.IsNullOrEmpty(request.ClassId) ? null : Guid.Parse(request.ClassId),
            TopicId = string.IsNullOrEmpty(request.TopicId) ? null : Guid.Parse(request.TopicId),
            IsPublished = false,
            CreatedAt = DateTime.UtcNow,
            Questions = request.Questions.Select((q, idx) => new Question
            {
                Id = Guid.NewGuid(),
                Text = q.Text,
                Type = q.Type,
                Difficulty = q.Difficulty,
                Explanation = q.Explanation,
                CorrectAnswer = q.CorrectAnswer,
                VerifiedByTeacher = false,
                OrderIndex = idx,
                Options = q.Options.Select((o, oi) => new QuizOption
                {
                    Id = Guid.NewGuid(),
                    Text = o.Text,
                    IsCorrect = o.IsCorrect,
                    OrderIndex = oi
                }).ToList()
            }).ToList()
        };

        db.Quizzes.Add(quiz);
        await db.SaveChangesAsync();

        return new QuizDto
        {
            Id = quiz.Id.ToString(),
            ClassId = quiz.ClassId?.ToString() ?? "",
            TopicId = quiz.TopicId?.ToString(),
            Title = quiz.Title,
            Type = quiz.Type,
            IsPublished = quiz.IsPublished,
            QuestionCount = quiz.Questions.Count,
            CreatedAt = quiz.CreatedAt.ToString("o")
        };
    }

    public async Task<QuizDto> CreatePrivateQuizAsync(Guid ownerId, CreateQuizRequest request)
    {
        request.ClassId = null;
        request.TopicId = null;
        var quizDto = await CreateQuizAsync(request, "private");
        var quiz = await db.Quizzes.FindAsync(Guid.Parse(quizDto.Id));
        if (quiz != null)
        {
            quiz.OwnerId = ownerId;
            await db.SaveChangesAsync();
        }
        return quizDto;
    }

    public async Task<List<QuizDto>> GetClassQuizzesAsync(Guid classId)
    {
        return await db.Quizzes
            .Where(q => q.ClassId == classId)
            .OrderByDescending(q => q.CreatedAt)
            .Select(q => new QuizDto
            {
                Id = q.Id.ToString(),
                ClassId = q.ClassId.HasValue ? q.ClassId.Value.ToString() : "",
                TopicId = q.TopicId.HasValue ? q.TopicId.Value.ToString() : null,
                DocumentId = q.GeneratedFromDocuments.Any() ? q.GeneratedFromDocuments.First().Id.ToString() : null,
                Title = q.Title,
                Type = q.Type,
                IsPublished = q.IsPublished,
                QuestionCount = q.Questions.Count,
                CreatedAt = q.CreatedAt.ToString("o")
            })
            .ToListAsync();
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

    public async Task<QuestionDto?> AddQuestionAsync(Guid quizId, CreateQuestionRequest request)
    {
        var quiz = await db.Quizzes.Include(q => q.Questions).FirstOrDefaultAsync(q => q.Id == quizId);
        if (quiz == null) return null;

        var maxOrder = quiz.Questions.Count > 0 ? quiz.Questions.Max(q => q.OrderIndex) + 1 : 0;

        var question = new Question
        {
            Id = Guid.NewGuid(),
            QuizId = quizId,
            Text = request.Text,
            Type = request.Type,
            Difficulty = request.Difficulty,
            Explanation = request.Explanation,
            CorrectAnswer = request.CorrectAnswer,
            VerifiedByTeacher = false,
            OrderIndex = maxOrder,
            Options = request.Options.Select((o, i) => new QuizOption
            {
                Id = Guid.NewGuid(),
                Text = o.Text,
                IsCorrect = o.IsCorrect,
                OrderIndex = i
            }).ToList()
        };

        db.Questions.Add(question);
        await db.SaveChangesAsync();

        return MapToDto(question);
    }

    public async Task<string?> GetTopicNameAsync(Guid topicId)
    {
        var topic = await db.Topics.FindAsync(topicId);
        return topic?.Name;
    }

    public async Task<Guid?> GetTopicClassIdAsync(Guid topicId)
    {
        var topic = await db.Topics.FindAsync(topicId);
        return topic?.ClassId;
    }

    public async Task<List<string>> GetRecentTutorQuestionTextsAsync(Guid topicId, int limit = 150)
    {
        return await db.Questions
            .Where(q => q.Quiz.TopicId == topicId && q.Quiz.Type == "tutor")
            .OrderByDescending(q => q.OrderIndex)
            .Select(q => q.Text)
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Distinct()
            .Take(limit)
            .ToListAsync();
    }

    public async Task<Guid> PersistTutorQuestionAsync(Guid topicId, AgentQuizResponse agentQuestion)
    {
        var quizId = await GetOrCreateTutorQuizAsync(topicId);
        var orderIndex = await db.Questions.CountAsync(q => q.QuizId == quizId);
        var correctKey = agentQuestion.Options.Keys.FirstOrDefault(k =>
            string.Equals(k, agentQuestion.CorrectAnswer, StringComparison.OrdinalIgnoreCase)) ?? agentQuestion.CorrectAnswer;

        var difficulty = agentQuestion.DifficultyLevel switch
        {
            < 0.35 => "easy",
            > 0.65 => "hard",
            _ => "medium"
        };

        var question = new Question
        {
            Id = Guid.NewGuid(),
            QuizId = quizId,
            Text = agentQuestion.Question,
            Type = "mcq",
            Difficulty = difficulty,
            Explanation = agentQuestion.Explanation,
            CorrectAnswer = agentQuestion.Options.GetValueOrDefault(correctKey, agentQuestion.CorrectAnswer),
            OrderIndex = orderIndex,
            Options = agentQuestion.Options.Select((kv, i) => new QuizOption
            {
                Id = Guid.NewGuid(),
                Text = kv.Value,
                IsCorrect = string.Equals(kv.Key, correctKey, StringComparison.OrdinalIgnoreCase),
                OrderIndex = i
            }).ToList()
        };

        db.Questions.Add(question);
        await db.SaveChangesAsync();
        return question.Id;
    }

    public async Task<QuestionDto?> GetTutorQuestionAsync(Guid topicId, Guid questionId)
    {
        var question = await db.Questions
            .Include(q => q.Options)
            .Include(q => q.Quiz)
            .FirstOrDefaultAsync(q => q.Id == questionId && q.Quiz.TopicId == topicId && q.Quiz.Type == "tutor");

        return question == null ? null : MapToDto(question);
    }

    private async Task<Guid> GetOrCreateTutorQuizAsync(Guid topicId)
    {
        var quiz = await db.Quizzes.FirstOrDefaultAsync(q => q.TopicId == topicId && q.Type == "tutor");
        if (quiz != null) return quiz.Id;

        var topic = await db.Topics.FindAsync(topicId);
        quiz = new Quiz
        {
            Id = Guid.NewGuid(),
            Title = $"Tutor - {topic?.Name ?? topicId.ToString()}",
            Type = "tutor",
            TopicId = topicId,
            IsPublished = false
        };
        db.Quizzes.Add(quiz);
        await db.SaveChangesAsync();
        return quiz.Id;
    }

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
                    "fill_blank" => answer.FillBlankValue?.Trim().Equals(question.CorrectAnswer?.Trim(), StringComparison.OrdinalIgnoreCase) == true,
                    "mcq" => question.Options.Any(o => o.IsCorrect && answer.SelectedOptionIds.Contains(o.Id.ToString())),
                    "multi_select" =>
                        question.Options.Where(o => o.IsCorrect).Select(o => o.Id.ToString()).OrderBy(x => x).SequenceEqual(
                        answer.SelectedOptionIds.OrderBy(x => x)),
                    _ => false
                };

                if (correct) score++;

                if (quiz.TopicId.HasValue)
                {
                    await learningStates.UpdateAfterAnswerAsync(studentId, new UpdateBktRequest
                    {
                        TopicId = quiz.TopicId.Value,
                        QuestionId = question.Id,
                        IsCorrect = correct
                    });
                }
            }
        }
        else
        {
            score = (int)Math.Ceiling(total * 0.65);
        }

        double pct = total > 0 ? score * 100.0 / total : 0;
        var grade = pct >= 90 ? "Xuất sắc" : pct >= 70 ? "Tốt" : pct >= 50 ? "Trung bình" : "Cần cải thiện";

        var result = new QuizResultDto
        {
            QuizId = quiz?.Id.ToString() ?? "",
            Score = score,
            Total = total,
            Percentage = pct,
            Grade = grade,
            CompletedAt = DateTime.UtcNow.ToString("o"),
            TopicScores = []
        };

        if (quiz != null)
        {
            var submission = new QuizSubmission
            {
                Id = Guid.NewGuid(),
                StudentId = studentId,
                QuizId = quiz.Id,
                Score = score,
                TotalQuestions = total,
                Percentage = pct,
                Grade = grade,
                AnswersJson = JsonSerializer.Serialize(request.Answers),
                CompletedAt = DateTime.UtcNow
            };
            db.QuizSubmissions.Add(submission);
            await db.SaveChangesAsync();
        }

        return result;
    }

    private static Question MapAgentQuestionToEntity(AgentQuizBatchQuestion aiQ, int orderIndex) => new()
    {
        Id = Guid.NewGuid(),
        Text = aiQ.Question,
        Type = string.IsNullOrWhiteSpace(aiQ.Type) ? "mcq" : aiQ.Type,
        Difficulty = string.IsNullOrWhiteSpace(aiQ.Difficulty) ? "medium" : aiQ.Difficulty,
        Explanation = aiQ.Explanation,
        CorrectAnswer = aiQ.Options.FirstOrDefault(o => o.IsCorrect)?.Text ?? "",
        VerifiedByTeacher = false,
        OrderIndex = orderIndex,
        Options = aiQ.Options.Select((o, i) => new QuizOption
        {
            Id = Guid.NewGuid(),
            Text = o.Text,
            IsCorrect = o.IsCorrect,
            OrderIndex = i
        }).ToList()
    };

    private static Question CreatePlaceholderQuestion(string topicName, string difficulty, int orderIndex, int index) => new()
    {
        Id = Guid.NewGuid(),
        Text = $"[AI] Câu hỏi về {topicName} ({index})",
        Type = "mcq",
        Difficulty = difficulty,
        Explanation = $"Đây là câu hỏi đánh giá kiến thức về {topicName}.",
        VerifiedByTeacher = false,
        OrderIndex = orderIndex,
        Options =
        [
            new QuizOption { Id = Guid.NewGuid(), Text = "Đáp án A", IsCorrect = true,  OrderIndex = 0 },
            new QuizOption { Id = Guid.NewGuid(), Text = "Đáp án B", IsCorrect = false, OrderIndex = 1 },
            new QuizOption { Id = Guid.NewGuid(), Text = "Đáp án C", IsCorrect = false, OrderIndex = 2 },
            new QuizOption { Id = Guid.NewGuid(), Text = "Đáp án D", IsCorrect = false, OrderIndex = 3 },
        ]
    };

    private static QuestionDto MapToDto(Question q) => new()
    {
        Id = q.Id.ToString(),
        QuizId = q.QuizId.ToString(),
        TopicId = q.Quiz?.TopicId?.ToString() ?? "",
        Text = q.Text,
        Type = q.Type,
        Difficulty = q.Difficulty,
        Explanation = q.Explanation,
        CorrectAnswer = q.CorrectAnswer,
        VerifiedByTeacher = q.VerifiedByTeacher,
        OrderIndex = q.OrderIndex,
        Options = q.Options.OrderBy(o => o.OrderIndex).Select(o => new OptionDto
        {
            Id = o.Id.ToString(),
            Text = o.Text,
            IsCorrect = o.IsCorrect
        }).ToList()
    };

    public async Task CompleteTutorPracticeAsync(Guid userId, Guid topicId, int questionsAttempted, int correctAnswers)
    {
        if (questionsAttempted <= 0) return;

        var score = (double)correctAnswers / questionsAttempted * 100;
        var now = DateTime.UtcNow;

        db.LearningSessions.Add(new LearningSession
        {
            UserId = userId,
            TopicId = topicId,
            StartTime = now,
            EndTime = now,
            QuestionsAttempted = questionsAttempted,
            CorrectAnswers = correctAnswers,
            Score = score
        });

        var profile = await db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile != null)
        {
            var today = now.Date;
            if (profile.LastActiveDate?.Date == today.AddDays(-1))
                profile.LearningStreak++;
            else if (profile.LastActiveDate?.Date != today)
                profile.LearningStreak = 1;

            profile.LastActiveDate = now;
            profile.UpdatedAt = now;
        }

        await db.SaveChangesAsync();
    }
}
