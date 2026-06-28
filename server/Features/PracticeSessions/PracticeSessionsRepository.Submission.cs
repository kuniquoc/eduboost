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

        var question = await db.Questions

            .Include(q => q.Options)

            .Include(q => q.Quiz)

            .FirstOrDefaultAsync(q => q.Id == questionId)

            ?? throw new InvalidOperationException("Question not found");



        var selectedOptionId = request.SelectedOptionId

            ?? request.SelectedOptionIds?.FirstOrDefault();



        bool isCorrect;

        string? correctAnswer;

        if (question.Type == "fill_blank")

        {

            isCorrect = string.Equals(question.CorrectAnswer?.Trim(), request.TextAnswer?.Trim(), StringComparison.OrdinalIgnoreCase);

            correctAnswer = question.CorrectAnswer;

        }

        else

        {

            var correctOption = question.Options.FirstOrDefault(o => o.IsCorrect);

            isCorrect = correctOption != null && correctOption.Id.ToString() == selectedOptionId;

            correctAnswer = correctOption?.Text;

        }



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



        UpdateBktResponse? updateResult = null;

        double masteryForDecision;

        double thetaForDecision;

        double? thetaBefore = null;

        double? thetaAfter = null;

        double? questionBeta = null;

        var topicIdForAnswer = ResolveQuestionTopicId(question) ?? state.TopicId;

        var beta = DifficultyIndex.Clamp(question.DifficultyIndex);



        if (isSelfPractice)

        {

            thetaBefore = state.SessionTheta;

            var bktResult = BktIrtCalculator.ApplyUpdate(

                state.SessionMastery, 0.25, 0.1, 0.1,

                state.SessionTheta, beta, isCorrect);

            state.SessionMastery = bktResult.Mastery;

            state.SessionTheta = bktResult.Theta;

            thetaAfter = bktResult.Theta;

            questionBeta = bktResult.Beta;

            masteryForDecision = state.SessionMastery;

            thetaForDecision = state.SessionTheta;

        }

        else

        {

            updateResult = await learningStates.UpdateAfterAnswerAsync(userId, new UpdateBktRequest

            {

                TopicId = topicIdForAnswer,

                QuestionId = questionId,

                IsCorrect = isCorrect,

                ResponseTime = isTestMode ? null : request.ResponseTimeSeconds,

                QuestionDifficultyIndex = question.DifficultyIndex

            });

            masteryForDecision = updateResult.State.MasteryProbability;

            thetaForDecision = updateResult.State.IrtTheta;

            thetaBefore = updateResult.ThetaBefore;

            thetaAfter = updateResult.ThetaAfter;

            questionBeta = updateResult.QuestionBeta;

        }



        bool isComplete = state.CurrentIndex >= state.Questions.Count;

        PracticeQuestionDto? nextQuestion = null;
        string? agentAction = null;
        string? agentReason = null;
        string? agentExplanation = null;
        bool recommendNextSkill = false;
        string? nextSkillSuggestion = null;
        double? targetBeta = null;
        string? suggestedNextTopicId = null;
        string? suggestedNextTopicName = null;



        if (!isComplete)

        {
            if (_irtAdaptiveSelectionEnabled
                && !isTestMode
                && (updateResult != null || isSelfPractice)
                && (string.Equals(state.Mode, "standard", StringComparison.OrdinalIgnoreCase)
                    || isSelfPractice))
            {
                var reorderTheta = isSelfPractice ? state.SessionTheta : updateResult!.ThetaAfter;
                await ReorderRemainingQuestionsByThetaAsync(state, reorderTheta);
            }

            var nextQ = await db.Questions

                .Include(q => q.Options)

                .FirstOrDefaultAsync(q => q.Id == state.Questions[state.CurrentIndex]);

            if (nextQ != null) nextQuestion = MapQuestionDto(nextQ);

            else isComplete = true;

        }

        if (!isTestMode && (updateResult != null || isSelfPractice))
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
            targetBeta = decision.TargetBeta;
            suggestedNextTopicId = decision.SuggestedNextTopicId;
            suggestedNextTopicName = decision.SuggestedNextTopicName;

            _logger?.LogInformation(
                "Practice decision user={UserId} topic={TopicId} action={Action} mastery={Mastery:F3} theta_before={ThetaBefore:F3} theta_after={ThetaAfter:F3} beta={Beta:F3}",
                userId,
                state.TopicId,
                agentAction ?? "N/A",
                masteryForDecision,
                thetaBefore,
                thetaAfter,
                questionBeta
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

            ThetaBefore = thetaBefore,

            ThetaAfter = thetaAfter,

            QuestionBeta = questionBeta,

            TargetBeta = targetBeta,

            SessionMastery = isSelfPractice ? state.SessionMastery : null,

            DbMasteryBaseline = isSelfPractice ? state.DbMasteryBaseline : null,

            SuggestedNextTopicId = suggestedNextTopicId,

            SuggestedNextTopicName = suggestedNextTopicName

        };

    }



}
