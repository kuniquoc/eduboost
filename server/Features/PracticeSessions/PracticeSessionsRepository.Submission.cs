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
    public async Task<SubmitAnswerResponse> SubmitAnswerAsync(Guid userId, SubmitAnswerRequest request)

    {

        var session = await _sessionStore.LoadAsync(userId, request.SessionId);

        var state = _sessionStore.Deserialize(session);



        var questionId = Guid.Parse(request.QuestionId);
        if (state.CurrentIndex >= state.Questions.Count || state.Questions[state.CurrentIndex] != questionId)
            throw new InvalidOperationException("Question is not the current session question");

        var sequence = state.CurrentIndex;

        var question = await db.Questions

            .Include(q => q.Options)

            .Include(q => q.IrtItem)

            .Include(q => q.Quiz)

            .FirstOrDefaultAsync(q => q.Id == questionId)

            ?? throw new InvalidOperationException("Question not found");



        var selectedOptionId = request.SelectedOptionId

            ?? request.SelectedOptionIds?.FirstOrDefault();



        var selectedOptionIds = request.SelectedOptionIds ??
            (request.SelectedOptionId == null ? [] : [request.SelectedOptionId]);
        var isCorrect = QuestionGrader.Grade(question, selectedOptionIds, request.TextAnswer);
        var correctAnswer = question.Type == "fill_blank"
            ? question.CorrectAnswer
            : string.Join(", ", question.Options.Where(o => o.IsCorrect).Select(o => o.Text));



        if (isCorrect) state.CorrectCount++;

        state.CurrentIndex++;



        var isTestMode = string.Equals(state.Mode, "test", StringComparison.OrdinalIgnoreCase);

        var isSelfPractice = string.Equals(state.Mode, "self_practice", StringComparison.OrdinalIgnoreCase);



        state.Answers.Add(new PracticeAnswerState

        {

            QuestionId = questionId,

            SelectedOptionId = selectedOptionId,

            TextAnswer = request.TextAnswer,

            IsCorrect = isCorrect

        });



        var topicIdForAnswer = ResolveQuestionTopicId(question) ?? state.TopicId;
        var updateResult = await learningEvidence.RecordAsync(
            userId,
            topicIdForAnswer,
            question,
            isCorrect,
            state.Mode,
            session.Id,
            sequence);
        var masteryForDecision = updateResult.MasteryProbability;
        var thetaForDecision = updateResult.Theta;



        bool isComplete = state.CurrentIndex >= state.Questions.Count;

        PracticeQuestionDto? nextQuestion = null;
        string? agentAction = null;
        string? agentReason = null;
        string? agentExplanation = null;
        bool recommendNextSkill = false;
        string? nextSkillSuggestion = null;
        string? suggestedNextTopicId = null;
        string? suggestedNextTopicName = null;



        if (!isComplete)

        {
            if (!isTestMode
                && (string.Equals(state.Mode, "standard", StringComparison.OrdinalIgnoreCase)
                    || isSelfPractice))
            {
                await ReorderRemainingQuestionsByThetaAsync(state, updateResult.Theta);
            }

            var nextQ = await db.Questions

                .Include(q => q.Options)

                .Include(q => q.IrtItem)

                .FirstOrDefaultAsync(q => q.Id == state.Questions[state.CurrentIndex]);

            if (nextQ != null) nextQuestion = MapQuestionDto(nextQ);

            else isComplete = true;

        }

        if (!isTestMode)
        {
            var decision = await ResolveAgentDecisionAsync(
                userId,
                state,
                masteryForDecision,
                thetaForDecision
            );

            agentAction = decision.Action;
            agentReason = decision.Reason;
            agentExplanation = decision.Explanation;
            recommendNextSkill = decision.RecommendNextSkill;
            nextSkillSuggestion = decision.NextSkillSuggestion;
            suggestedNextTopicId = decision.SuggestedNextTopicId;
            suggestedNextTopicName = decision.SuggestedNextTopicName;

            _logger?.LogInformation(
                "Practice decision user={UserId} topic={TopicId} action={Action} mastery={Mastery:F3} theta={Theta:F3} beta={Beta:F3}",
                userId,
                state.TopicId,
                agentAction ?? "N/A",
                masteryForDecision,
                thetaForDecision,
                question.IrtItem.Beta
            );
        }



        await _sessionStore.SaveAsync(session, state);



        if (isTestMode)

        {

            return new SubmitAnswerResponse

            {

                FeedbackSuppressed = true,

                NextQuestion = nextQuestion,

                QuestionNumber = isComplete ? state.CurrentIndex : state.CurrentIndex + 1,

                TotalQuestions = state.Questions.Count,

                IsSessionComplete = isComplete

            };

        }



        return new SubmitAnswerResponse

        {

            IsCorrect = isCorrect,

            CorrectAnswer = correctAnswer,

            Explanation = question.Explanation,

            NextQuestion = nextQuestion,

            QuestionNumber = state.CurrentIndex + 1,

            TotalQuestions = state.Questions.Count,

            IsSessionComplete = isComplete,

            AgentAction = agentAction,

            AgentReason = agentReason,

            AgentExplanation = agentExplanation,

            RecommendNextSkill = recommendNextSkill,

            NextSkillSuggestion = nextSkillSuggestion,

            SuggestedNextTopicId = suggestedNextTopicId,

            SuggestedNextTopicName = suggestedNextTopicName

        };

    }



}
