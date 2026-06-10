import { useQuery } from '@tanstack/react-query';
import { poolService } from '@/services/pool.service';

export function usePoolTopics(search: string, classId?: string) {
  return useQuery({
    queryKey: ['pool-topics', search, classId],
    queryFn: () => poolService.getTopicsInPool(search, classId),
  });
}
