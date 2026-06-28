namespace EduBoost.API.Features.PracticeSessions;

internal sealed class PracticeSessionState
{
    public Guid UserId { get; set; }
    public Guid TopicId { get; set; }
    public string TopicName { get; set; } = "";
    public string Mode { get; set; } = "standard";
    public Guid? QuizId { get; set; }
    public Guid? ClassId { get; set; }
    public List<Guid> Questions { get; set; } = [];
    public List<Guid> AffectedTopicIds { get; set; } = [];
    public int CurrentIndex { get; set; }
    public int CorrectCount { get; set; }
    public DateTime StartTime { get; set; }
    public double MasteryBefore { get; set; }
    public double DbMasteryBaseline { get; set; }
    public double DbThetaBaseline { get; set; }
    public double SessionMastery { get; set; }
    public double SessionTheta { get; set; }
    public List<PracticeAnswerState> Answers { get; set; } = [];
}

internal sealed class PracticeAnswerState
{
    public Guid QuestionId { get; set; }
    public string? SelectedOptionId { get; set; }
    public string? TextAnswer { get; set; }
    public bool IsCorrect { get; set; }
}
