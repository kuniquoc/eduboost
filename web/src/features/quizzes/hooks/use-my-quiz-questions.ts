import { useQuery } from '@tanstack/react-query';
import { quizzesService } from '@/features/quizzes/api/quizzes.service';

export function useMyQuizQuestions(quizId: string | undefined) {
  return useQuery({
    queryKey: ['my-quiz-questions', quizId],
    queryFn: () => quizzesService.getMyQuizQuestions(quizId!),
    enabled: !!quizId,
  });
}
