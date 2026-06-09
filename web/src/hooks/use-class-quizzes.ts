import { useQuery } from '@tanstack/react-query';
import { quizzesService } from '@/services/quizzes.service';

export function useClassQuizzes(classId: string | undefined) {
  return useQuery({
    queryKey: ['class-quizzes', classId],
    queryFn: () => quizzesService.getClassQuizzes(classId!),
    enabled: !!classId,
  });
}
