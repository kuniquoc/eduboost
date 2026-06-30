using System.Text.Json;

using EduBoost.API.Features.LearningStates;

using EduBoost.API.Features.LearningStates.Models;

using EduBoost.API.Features.Roadmap;

using EduBoost.API.Features.PracticeSessions.Models;

using EduBoost.API.Infrastructure;

using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes.Services;
using EduBoost.API.Features.Students.Services;
using EduBoost.API.Infrastructure.Integrations.Agent;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EduBoost.API.Features.PracticeSessions;

public partial class PracticeSessionsRepository
{
    public async Task<PracticeSessionSummary> EndSessionAsync(Guid userId, string sessionId)

    {

        var session = await _sessionStore.LoadAsync(userId, sessionId);

        var state = _sessionStore.Deserialize(session);

        db.PracticeActiveSessions.Remove(session);



        var score = state.CurrentIndex > 0 ? (double)state.CorrectCount / state.CurrentIndex * 100 : 0;

        var bktAfter = await db.BktStates

            .FirstOrDefaultAsync(b => b.UserId == userId && b.TopicId == state.TopicId);

        var masteryAfter = bktAfter?.MasteryProbability ?? state.MasteryBefore;

        if (state.QuizId.HasValue && state.CurrentIndex > 0)
        {
            var grade = score >= 90 ? "Xuất sắc" : score >= 70 ? "Tốt" : score >= 50 ? "Trung bình" : "Cần cải thiện";
            db.QuizSubmissions.Add(new QuizSubmission
            {
                Id = Guid.NewGuid(),
                StudentId = userId,
                QuizId = state.QuizId.Value,
                Score = state.CorrectCount,
                TotalQuestions = state.CurrentIndex,
                Percentage = score,
                Grade = grade,
                AnswersJson = JsonSerializer.Serialize(state.Answers),
                CompletedAt = DateTime.UtcNow
            });
        }



        db.LearningSessions.Add(new LearningSession

        {

            UserId = userId,

            TopicId = state.TopicId,

            StartTime = state.StartTime,

            EndTime = DateTime.UtcNow,

            QuestionsAttempted = state.CurrentIndex,

            CorrectAnswers = state.CorrectCount,

            Score = score

        });



        var profile = await db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile != null)

        {

            var today = DateTime.UtcNow.Date;

            if (profile.LastActiveDate?.Date == today.AddDays(-1))

                profile.LearningStreak++;

            else if (profile.LastActiveDate?.Date != today)

                profile.LearningStreak = 1;



            profile.LastActiveDate = DateTime.UtcNow;

            profile.UpdatedAt = DateTime.UtcNow;

        }



        await db.SaveChangesAsync();



        IEnumerable<Guid> topicsToSync = state.AffectedTopicIds is { Count: > 0 }
                ? state.AffectedTopicIds
                : [state.TopicId];



        foreach (var topicId in topicsToSync.Distinct())

        {

            var syncTopic = await db.Topics.FindAsync(topicId);

            if (syncTopic?.ClassId is Guid classId)

                await roadmap.SyncAfterLearningAsync(classId, userId, topicId);

        }



        string? recommendation = null;

        if (score >= 80) recommendation = "Xuất sắc! Bạn có thể chuyển sang chủ đề khó hơn.";

        else if (score < 50) recommendation = "Hãy ôn tập lại chủ đề này trước khi tiếp tục.";



        List<QuizReviewItemDto>? reviewItems = null;

        if (string.Equals(state.Mode, "test", StringComparison.OrdinalIgnoreCase) && state.Answers.Count > 0)

        {

            var answerQuestionIds = state.Answers.Select(a => a.QuestionId).ToList();

            var reviewQuestions = await db.Questions

                .Include(q => q.Options)

                .Where(q => answerQuestionIds.Contains(q.Id))

                .ToListAsync();



            reviewItems = state.Answers.Select(a =>

            {

                var q = reviewQuestions.First(rq => rq.Id == a.QuestionId);

                var correctOpt = q.Options.FirstOrDefault(o => o.IsCorrect);

                return new QuizReviewItemDto

                {

                    QuestionId = q.Id.ToString(),

                    Text = q.Text,

                    Type = q.Type,

                    Options = q.Options.OrderBy(o => o.OrderIndex).Select(o => new PracticeOptionDto

                    {

                        Id = o.Id.ToString(),

                        Text = o.Text

                    }).ToList(),

                    SelectedOptionId = a.SelectedOptionId,

                    CorrectOptionId = correctOpt?.Id.ToString(),

                    CorrectAnswer = correctOpt?.Text ?? q.CorrectAnswer,

                    IsCorrect = a.IsCorrect,

                    Explanation = q.Explanation

                };

            }).ToList();

        }



        return new PracticeSessionSummary

        {

            SessionId = sessionId,

            TopicName = state.TopicName,

            QuestionsAttempted = state.CurrentIndex,

            CorrectAnswers = state.CorrectCount,

            Score = score,

            MasteryChange = masteryAfter - state.MasteryBefore,

            Recommendation = recommendation,

            ItemsReviewed = 0,

            NextReviewSummary = null,

            ReviewItems = reviewItems

        };

    }



}
