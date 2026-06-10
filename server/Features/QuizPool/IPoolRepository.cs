using EduBoost.API.Features.Quizzes.Models;
using EduBoost.API.Features.QuizPool.Models;

namespace EduBoost.API.Features.QuizPool;

public enum DeletePoolQuizResult { Success, NotFound, Forbidden }

public interface IPoolRepository
{
    Task<QuizDto?> GeneratePoolQuizAsync(Guid userId, string userRole, GeneratePoolQuizRequest request);
    Task<List<TopicPoolDto>> GetTopicsInPoolAsync(Guid userId, string userRole, string? search, Guid? classId);
    Task<List<PoolQuizDetailDto>> GetQuizzesInTopicPoolAsync(Guid userId, Guid topicId);
    Task<List<Guid>> GetPoolQuizIdsForQuestionsAsync(IEnumerable<Guid> questionIds);
    Task<DeletePoolQuizResult> DeletePoolQuizAsync(Guid userId, Guid quizId);
    Task<QuizDto> CreateTestFromPoolAsync(Guid userId, CreateTestFromPoolRequest request);
    Task<QuizDto?> CreateEntryTestFromPoolAsync(Guid userId, CreateEntryTestFromPoolRequest request);
    Task<QuizDto> CreateRevisionSetFromPoolAsync(Guid userId, CreateRevisionSetFromPoolRequest request);
    Task<List<QuizDto>> GetRevisionSetsAsync(Guid userId);
    Task<TopicPoolDto?> RenameTopicAsync(Guid userId, string userRole, Guid topicId, string newName);
}
