import { useQuery } from '@tanstack/react-query';
import { poolService } from '@/services/pool.service';

export function useQuizzesInTopic(topicId: string | undefined) {
  return useQuery({
    queryKey: ['quizzes-in-topic', topicId],
    queryFn: () => poolService.getQuizzesInTopicPool(topicId!),
    enabled: !!topicId,
  });
}
