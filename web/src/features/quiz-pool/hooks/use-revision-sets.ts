import { useQuery } from '@tanstack/react-query';
import { poolService } from '@/features/quiz-pool/api/pool.service';

export function useRevisionSets(enabled = true) {
  return useQuery({
    queryKey: ['student-revision-sets'],
    queryFn: poolService.getRevisionSets,
    enabled,
  });
}
