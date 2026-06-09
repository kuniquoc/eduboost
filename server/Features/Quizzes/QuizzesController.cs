using EduBoost.API.Common.Http;
using EduBoost.API.Common.Models;
using EduBoost.API.Features.Classes;
using EduBoost.API.Features.Documents;
using EduBoost.API.Features.LearningStates;
using EduBoost.API.Features.LearningStates.Models;
using EduBoost.API.Features.Quizzes.Models;
using EduBoost.API.Features.Roadmap;
using EduBoost.API.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduBoost.API.Features.Quizzes;

[ApiController]
[Route("api/quizzes")]
[Authorize]
public class QuizzesController(
    IQuizzesRepository repo,
    IAgentService agent,
    IDocumentsRepository docRepo,
    ILearningStatesRepository learningStates,
    ITutorDecisionService tutorDecision,
    IRoadmapRepository roadmap,
    IClassesRepository classes,
    IQuizAuthorization quizAuth) : ControllerBase
{
    private Guid UserId => ControllerAuth.GetUserId(User);
    private string UserRole => ControllerAuth.GetUserRole(User);

    /// <summary>Teacher: Lấy câu hỏi của quiz để kiểm duyệt</summary>
    [HttpGet("{quizId:guid}/questions")]
    public async Task<IActionResult> GetQuestions(Guid quizId)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await quizAuth.CanTeacherManageQuizAsync(quizId, UserId)) return Forbid();
        var questions = await repo.GetQuestionsAsync(quizId);
        return Ok(ApiResponse<List<QuestionDto>>.Ok(questions));
    }

    /// <summary>Teacher: Chỉnh sửa câu hỏi</summary>
    [HttpPut("{quizId:guid}/questions/{qId:guid}")]
    public async Task<IActionResult> UpdateQuestion(Guid quizId, Guid qId, [FromBody] UpdateQuestionRequest request)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await quizAuth.CanTeacherManageQuizAsync(quizId, UserId)) return Forbid();
        if (!await quizAuth.QuestionBelongsToQuizAsync(quizId, qId)) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        var q = await repo.UpdateQuestionAsync(qId, request);
        if (q == null) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        return Ok(ApiResponse<QuestionDto>.Ok(q, "Cập nhật câu hỏi thành công"));
    }

    /// <summary>Teacher: Thêm câu hỏi vào quiz</summary>
    [HttpPost("{quizId:guid}/questions")]
    public async Task<IActionResult> AddQuestion(Guid quizId, [FromBody] CreateQuestionRequest request)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await quizAuth.CanTeacherManageQuizAsync(quizId, UserId)) return Forbid();
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var q = await repo.AddQuestionAsync(quizId, request);
        if (q == null) return NotFound(ApiResponse.Fail("Không tìm thấy quiz"));
        return Ok(ApiResponse<QuestionDto>.Ok(q, "Thêm câu hỏi thành công"));
    }

    /// <summary>Teacher: Xoá câu hỏi</summary>
    [HttpDelete("{quizId:guid}/questions/{qId:guid}")]
    public async Task<IActionResult> DeleteQuestion(Guid quizId, Guid qId)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await quizAuth.CanTeacherManageQuizAsync(quizId, UserId)) return Forbid();
        if (!await quizAuth.QuestionBelongsToQuizAsync(quizId, qId)) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        var ok = await repo.DeleteQuestionAsync(qId);
        if (!ok) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        return Ok(ApiResponse.Ok("Xoá câu hỏi thành công"));
    }

    /// <summary>Teacher: Đánh dấu câu hỏi đã/chưa được kiểm duyệt</summary>
    [HttpPatch("{quizId:guid}/questions/{qId:guid}/verify")]
    public async Task<IActionResult> VerifyQuestion(Guid quizId, Guid qId, [FromBody] VerifyQuestionRequest request)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await quizAuth.CanTeacherManageQuizAsync(quizId, UserId)) return Forbid();
        if (!await quizAuth.QuestionBelongsToQuizAsync(quizId, qId)) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        var q = await repo.VerifyQuestionAsync(qId, request.Verified);
        if (q == null) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        return Ok(ApiResponse<QuestionDto>.Ok(q, request.Verified ? "Đã xác nhận câu hỏi" : "Đã bỏ xác nhận"));
    }

    /// <summary>Teacher: Publish quiz lên lớp học</summary>
    [HttpPost("{quizId:guid}/publish")]
    public async Task<IActionResult> PublishQuiz(Guid quizId)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await quizAuth.CanTeacherManageQuizAsync(quizId, UserId)) return Forbid();
        var ok = await repo.PublishQuizAsync(quizId);
        if (!ok) return NotFound(ApiResponse.Fail("Không tìm thấy quiz"));
        return Ok(ApiResponse.Ok("Đã publish quiz. Học sinh có thể bắt đầu làm bài."));
    }

    /// <summary>Teacher: Tạo quiz thủ công cho lớp</summary>
    [HttpPost("create")]
    public async Task<IActionResult> CreateQuiz([FromBody] CreateQuizRequest request)
    {
        if (UserRole != "teacher") return Forbid();
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        if (request.Questions.Count == 0) return BadRequest(ApiResponse.Fail("Quiz cần ít nhất 1 câu hỏi"));

        var type = request.Type is "entry_test" or "practice" ? request.Type : "practice";

        if (type == "entry_test")
        {
            if (string.IsNullOrEmpty(request.ClassId))
                return BadRequest(ApiResponse.Fail("Entry test phải thuộc một lớp học"));
            var classId = Guid.Parse(request.ClassId);
            if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
            if (await repo.HasEntryTestAsync(classId))
                return Conflict(ApiResponse.Fail("Lớp này đã có bài test đầu vào. Vui lòng chỉnh sửa quiz hiện tại."));
        }
        else if (!string.IsNullOrEmpty(request.ClassId))
        {
            if (!await classes.IsOwnedByTeacherAsync(Guid.Parse(request.ClassId), UserId)) return Forbid();
        }

        var quiz = await repo.CreateQuizAsync(request, type);
        return Ok(ApiResponse<QuizDto>.Ok(quiz, type == "entry_test" ? "Tạo bài test đầu vào thành công" : "Tạo quiz thành công"));
    }

    /// <summary>Teacher: AI tự động tạo entry test từ các chủ đề của lớp</summary>
    [HttpPost("generate-entry-test/{classId:guid}")]
    public async Task<IActionResult> GenerateEntryTest(Guid classId)
    {
        if (UserRole != "teacher") return Forbid();
        if (!await classes.IsOwnedByTeacherAsync(classId, UserId)) return Forbid();
        if (await repo.HasEntryTestAsync(classId))
            return Conflict(ApiResponse.Fail("Lớp này đã có bài test đầu vào."));

        var quiz = await repo.GenerateEntryTestAsync(classId);
        return Ok(ApiResponse<QuizDto>.Ok(quiz, "AI đã tạo bài test đầu vào. Hãy kiểm tra và chỉnh sửa trước khi publish."));
    }

    /// <summary>Teacher/Student: Lấy danh sách quiz của lớp</summary>
    [HttpGet("class/{classId:guid}")]
    public async Task<IActionResult> GetClassQuizzes(Guid classId)
    {
        if (!await classes.CanUserAccessClassAsync(classId, UserId, UserRole)) return Forbid();
        var quizzes = await repo.GetClassQuizzesAsync(classId);
        return Ok(ApiResponse<List<QuizDto>>.Ok(quizzes));
    }

    /// <summary>Student: Tạo quiz thủ công cá nhân</summary>
    [HttpPost("my/create")]
    public async Task<IActionResult> CreateMyQuiz([FromBody] CreateQuizRequest request)
    {
        if (UserRole != "student") return Forbid();
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        if (request.Questions.Count == 0) return BadRequest(ApiResponse.Fail("Quiz cần ít nhất 1 câu hỏi"));
        var quiz = await repo.CreatePrivateQuizAsync(UserId, request);
        return Ok(ApiResponse<QuizDto>.Ok(quiz, "Tạo quiz cá nhân thành công"));
    }

    /// <summary>Student: Lấy bài test đầu vào của lớp (legacy — dùng placement-tests thay thế)</summary>
    [Obsolete("Use /api/placement-tests instead")]
    [HttpGet("entry-test/{classId:guid}")]
    public async Task<IActionResult> GetEntryTest(Guid classId)
    {
        if (UserRole != "student") return Forbid();
        if (!await classes.IsStudentEnrolledAsync(classId, UserId)) return Forbid();
        var test = await repo.GetEntryTestAsync(classId);
        if (test == null) return NotFound(ApiResponse.Fail("Lớp học chưa có bài test đầu vào"));
        return Ok(ApiResponse<EntryTestDto>.Ok(test));
    }

    /// <summary>Student: Nộp bài test đầu vào (legacy — dùng placement-tests thay thế)</summary>
    [Obsolete("Use /api/placement-tests instead")]
    [HttpPost("entry-test/{classId:guid}/submit")]
    public async Task<IActionResult> SubmitEntryTest(Guid classId, [FromBody] SubmitQuizRequest request)
    {
        if (UserRole != "student") return Forbid();
        if (!await classes.IsStudentEnrolledAsync(classId, UserId)) return Forbid();
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var result = await repo.SubmitEntryTestAsync(classId, UserId, request);
        return Ok(ApiResponse<QuizResultDto>.Ok(result, "Nộp bài thành công. AI đang tạo lộ trình học tập..."));
    }

    /// <summary>Student: Lấy câu hỏi luyện tập theo topic</summary>
    [HttpGet("practice/{topicId:guid}")]
    public async Task<IActionResult> GetPracticeQuiz(Guid topicId, [FromQuery] int limit = 10)
    {
        if (UserRole != "student") return Forbid();
        if (!await quizAuth.CanStudentAccessTopicAsync(topicId, UserId)) return Forbid();
        var quiz = await repo.GetPracticeQuizAsync(topicId, limit);
        return Ok(ApiResponse<EntryTestDto>.Ok(quiz));
    }

    /// <summary>Student: Nộp bài luyện tập</summary>
    [HttpPost("practice/{topicId:guid}/submit")]
    public async Task<IActionResult> SubmitPracticeQuiz(Guid topicId, [FromBody] SubmitQuizRequest request)
    {
        if (UserRole != "student") return Forbid();
        if (!await quizAuth.CanStudentAccessTopicAsync(topicId, UserId)) return Forbid();
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ", ModelState));
        var result = await repo.SubmitPracticeQuizAsync(topicId, UserId, request);
        return Ok(ApiResponse<QuizResultDto>.Ok(result, "Hoàn thành luyện tập!"));
    }

    /// <summary>Student: Lấy câu hỏi quiz riêng của mình</summary>
    [HttpGet("my/{quizId:guid}/questions")]
    public async Task<IActionResult> GetMyQuizQuestions(Guid quizId)
    {
        if (UserRole != "student") return Forbid();
        if (!await quizAuth.CanStudentAccessPrivateQuizAsync(quizId, UserId)) return Forbid();
        var questions = await repo.GetMyQuizQuestionsAsync(quizId);
        return Ok(ApiResponse<List<QuestionDto>>.Ok(questions));
    }

    /// <summary>Student: Chỉnh sửa câu hỏi trong quiz riêng của mình</summary>
    [HttpPut("my/{quizId:guid}/questions/{qId:guid}")]
    public async Task<IActionResult> UpdateMyQuestion(Guid quizId, Guid qId, [FromBody] UpdateQuestionRequest request)
    {
        if (UserRole != "student") return Forbid();
        if (!await quizAuth.CanStudentAccessPrivateQuizAsync(quizId, UserId)) return Forbid();
        if (!await quizAuth.QuestionBelongsToQuizAsync(quizId, qId)) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        var q = await repo.UpdateMyQuestionAsync(qId, request);
        if (q == null) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        return Ok(ApiResponse<QuestionDto>.Ok(q, "Cập nhật thành công"));
    }

    /// <summary>Student: Xoá câu hỏi trong quiz riêng của mình</summary>
    [HttpDelete("my/{quizId:guid}/questions/{qId:guid}")]
    public async Task<IActionResult> DeleteMyQuestion(Guid quizId, Guid qId)
    {
        if (UserRole != "student") return Forbid();
        if (!await quizAuth.CanStudentAccessPrivateQuizAsync(quizId, UserId)) return Forbid();
        if (!await quizAuth.QuestionBelongsToQuizAsync(quizId, qId)) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        var ok = await repo.DeleteQuestionAsync(qId);
        if (!ok) return NotFound(ApiResponse.Fail($"Không tìm thấy câu hỏi '{qId}'"));
        return Ok(ApiResponse.Ok("Xoá câu hỏi thành công"));
    }

    // ── AI Tutor Endpoints ───────────────────────────────────────────────────

    /// <summary>Student: Get AI Tutor next action for a topic</summary>
    [HttpGet("tutor/next-action")]
    public async Task<IActionResult> GetTutorNextAction([FromQuery] Guid topicId)
    {
        if (UserRole != "student") return Forbid();
        if (!await quizAuth.CanStudentAccessTopicAsync(topicId, UserId)) return Forbid();
        var topic = await repo.GetTopicNameAsync(topicId);
        if (topic == null) return NotFound(ApiResponse.Fail("Topic not found"));

        var bkt = await learningStates.GetStateByTopicAsync(UserId, topicId);
        var mastery = bkt?.MasteryProbability ?? 0.3;
        var theta = bkt?.IrtTheta ?? 0;

        var response = tutorDecision.DecideNextAction(topic, mastery, theta);
        return Ok(ApiResponse<AgentNextActionResponse>.Ok(response));
    }

    /// <summary>Student: Submit single answer for adaptive quiz</summary>
    [HttpPost("tutor/submit-answer")]
    public async Task<IActionResult> SubmitTutorAnswer([FromBody] TutorAnswerRequest request)
    {
        if (UserRole != "student") return Forbid();
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Invalid request data", ModelState));

        if (!Guid.TryParse(request.TopicId, out var topicId))
            return BadRequest(ApiResponse.Fail("Invalid TopicId format"));

        if (!Guid.TryParse(request.QuestionId, out var questionId))
            return BadRequest(ApiResponse.Fail("Invalid QuestionId format"));

        if (!await quizAuth.CanStudentAccessTopicAsync(topicId, UserId)) return Forbid();

        var topic = await repo.GetTopicNameAsync(topicId);
        if (topic == null) return NotFound(ApiResponse.Fail("Topic not found"));

        bool isCorrect = request.SelectedAnswer.Trim()
            .Equals(request.CorrectAnswer.Trim(), StringComparison.OrdinalIgnoreCase);

        var updateResult = await learningStates.UpdateAfterAnswerAsync(UserId, new UpdateBktRequest
        {
            TopicId = topicId,
            QuestionId = questionId,
            IsCorrect = isCorrect,
            ResponseTime = request.ResponseTimeSeconds
        });

        var classId = await repo.GetTopicClassIdAsync(topicId);
        if (classId.HasValue)
            await roadmap.SyncAfterLearningAsync(classId.Value, UserId, topicId);

        string explanation = isCorrect ? "Correct! Well done." : $"The correct answer is '{request.CorrectAnswer}'.";

        var masteryLabel = updateResult.State.MasteryProbability >= 0.95 ? "mastered"
            : updateResult.State.MasteryProbability >= 0.7 ? "proficient"
            : updateResult.State.MasteryProbability >= 0.4 ? "learning"
            : "needs_review";

        var result = new TutorAnswerResult
        {
            IsCorrect = isCorrect,
            Explanation = explanation,
            Mastery = masteryLabel,
            NewProbability = updateResult.State.MasteryProbability,
            NewTheta = updateResult.State.IrtTheta,
            NextAction = null
        };

        return Ok(ApiResponse<TutorAnswerResult>.Ok(result));
    }

    /// <summary>Student: Ghi nhận kết thúc phiên AI Tutor (streak, learning_sessions)</summary>
    [HttpPost("tutor/complete-practice")]
    public async Task<IActionResult> CompleteTutorPractice([FromBody] TutorCompletePracticeRequest request)
    {
        if (UserRole != "student") return Forbid();
        if (!Guid.TryParse(request.TopicId, out var topicId))
            return BadRequest(ApiResponse.Fail("Invalid TopicId format"));
        if (!await quizAuth.CanStudentAccessTopicAsync(topicId, UserId)) return Forbid();
        if (request.QuestionsAttempted <= 0)
            return BadRequest(ApiResponse.Fail("QuestionsAttempted must be greater than 0"));

        await repo.CompleteTutorPracticeAsync(
            UserId,
            topicId,
            request.QuestionsAttempted,
            request.CorrectAnswers);

        return Ok(ApiResponse.Ok("Đã ghi nhận phiên luyện tập"));
    }

    /// <summary>Student: Get AI explanation for a topic</summary>
    [HttpGet("tutor/explain")]
    public async Task<IActionResult> GetTutorExplanation([FromQuery] Guid topicId)
    {
        if (UserRole != "student") return Forbid();
        if (!await quizAuth.CanStudentAccessTopicAsync(topicId, UserId)) return Forbid();
        var topic = await repo.GetTopicNameAsync(topicId);
        if (topic == null) return NotFound(ApiResponse.Fail("Topic not found"));

        var allowedDocIds = await docRepo.GetAllowedDocumentIdsAsync(UserId);
        var allowedScopes = new List<string> { "system" };

        var explanation = await agent.GetExplanationAsync(topic, "needs_review", allowedDocIds, allowedScopes);
        if (explanation == null)
        {
            return Ok(ApiResponse<object>.Ok(new
            {
                explanation = $"Review the key concepts of '{topic}'. The AI tutor is currently offline — please try again later.",
                offline = true
            }));
        }

        return Ok(ApiResponse<object>.Ok(new { explanation, offline = false }));
    }

    /// <summary>Student: Get detailed explanation for wrong answer</summary>
    [HttpPost("tutor/explain-error")]
    public async Task<IActionResult> GetErrorExplanation([FromBody] ExplainErrorRequest request)
    {
        if (UserRole != "student") return Forbid();
        if (!ModelState.IsValid) return BadRequest(ApiResponse.Fail("Invalid request data", ModelState));

        var allowedDocIds = await docRepo.GetAllowedDocumentIdsAsync(UserId);
        var allowedScopes = new List<string> { "system" };

        var explanation = await agent.GetGraderExplanationAsync(
            request.Question, request.CorrectAnswer, request.StudentAnswer, allowedDocIds, allowedScopes);

        if (explanation == null)
        {
            return Ok(ApiResponse<object>.Ok(new
            {
                explanation = $"The correct answer is '{request.CorrectAnswer}'. The AI tutor is currently offline for detailed explanations.",
                offline = true
            }));
        }

        return Ok(ApiResponse<object>.Ok(new { explanation, offline = false }));
    }

    /// <summary>Student: Generate one adaptive quiz question</summary>
    [HttpGet("tutor/generate-question")]
    public async Task<IActionResult> GenerateAdaptiveQuestion([FromQuery] Guid topicId, [FromQuery] double? difficulty = null)
    {
        if (UserRole != "student") return Forbid();
        if (!await quizAuth.CanStudentAccessTopicAsync(topicId, UserId)) return Forbid();
        var topic = await repo.GetTopicNameAsync(topicId);
        if (topic == null) return NotFound(ApiResponse.Fail("Topic not found"));

        var bkt = await learningStates.GetStateByTopicAsync(UserId, topicId);
        var effectiveDifficulty = difficulty
            ?? tutorDecision.MapMasteryToDifficulty(bkt?.MasteryProbability ?? 0.3, bkt?.IrtTheta ?? 0);

        var allowedDocIds = await docRepo.GetAllowedDocumentIdsAsync(UserId);
        var allowedScopes = new List<string> { "system" };

        var agentQuestion = await agent.GenerateQuizQuestionAsync(topic, effectiveDifficulty, allowedDocIds, allowedScopes);
        if (agentQuestion == null)
        {
            return Ok(ApiResponse<object>.Ok(new
            {
                question = $"Practice question for '{topic}' is unavailable. The AI agent is offline.",
                options = new Dictionary<string, string>(),
                correctAnswer = "",
                explanation = "",
                difficultyLevel = effectiveDifficulty,
                offline = true
            }));
        }

        var dto = new TutorQuestionDto
        {
            Question = agentQuestion.Question,
            Options = agentQuestion.Options,
            CorrectAnswer = agentQuestion.CorrectAnswer,
            Explanation = agentQuestion.Explanation,
            DifficultyLevel = agentQuestion.DifficultyLevel
        };

        var questionId = await repo.PersistTutorQuestionAsync(topicId, agentQuestion);
        dto.QuestionId = questionId.ToString();

        return Ok(ApiResponse<TutorQuestionDto>.Ok(dto));
    }
}
