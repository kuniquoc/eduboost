import { useQuery } from '@tanstack/react-query';
import { poolService } from '@/services/pool.service';

export function usePoolTopics(search: string) {
  return useQuery({
    queryKey: ['pool-topics', search],
    queryFn: () => poolService.getTopicsInPool(search),
  });
}
