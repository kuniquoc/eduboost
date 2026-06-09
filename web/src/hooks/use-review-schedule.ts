import { useQuery } from '@tanstack/react-query';
import { learningStateService } from '@/services/learningState.service';

export function useReviewSchedule() {
  return useQuery({
    queryKey: ['review-schedule'],
    queryFn: learningStateService.getReviewSchedule,
  });
}
