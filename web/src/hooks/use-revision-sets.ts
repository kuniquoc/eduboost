import { useQuery } from '@tanstack/react-query';
import { poolService } from '@/services/pool.service';

export function useRevisionSets(enabled = true) {
  return useQuery({
    queryKey: ['student-revision-sets'],
    queryFn: poolService.getRevisionSets,
    enabled,
  });
}
