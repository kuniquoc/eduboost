import { useQuery } from '@tanstack/react-query';
import { topicsService } from '@/features/classes/api/topics.service';

export function useClassTopics(classId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['class-topics', classId],
    queryFn: () => topicsService.getTopics(classId!),
    enabled: !!classId && enabled,
  });
}
