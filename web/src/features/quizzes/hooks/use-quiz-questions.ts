import { useQuery } from '@tanstack/react-query';
import { quizzesService } from '@/features/quizzes/api/quizzes.service';

export function useQuizQuestions(quizId: string | undefined) {
  return useQuery({
    queryKey: ['quiz-questions', quizId],
    queryFn: () => quizzesService.getQuestions(quizId!),
    enabled: !!quizId,
  });
}
