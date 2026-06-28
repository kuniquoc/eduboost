import { useQuery } from '@tanstack/react-query';
import { quizzesService } from '@/features/quizzes/api/quizzes.service';

export function useClassQuizzes(classId: string | undefined) {
  return useQuery({
    queryKey: ['class-quizzes', classId],
    queryFn: () => quizzesService.getClassQuizzes(classId!),
    enabled: !!classId,
  });
}
