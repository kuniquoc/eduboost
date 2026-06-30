namespace EduBoost.API.Features.LearningStates.Models;

public class BktStateDto
{
    public string TopicId { get; set; } = "";
    public string TopicName { get; set; } = "";
    public double MasteryProbability { get; set; }
    public double IrtTheta { get; set; }
    public double IrtThetaStandardError { get; set; } = 1.0;
    public int IrtResponseCount { get; set; }
    public string UpdatedAt { get; set; } = "";
}
