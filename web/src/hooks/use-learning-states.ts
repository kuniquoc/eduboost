import { useQuery } from '@tanstack/react-query';
import { learningStateService } from '@/services/learningState.service';

export function useLearningStates() {
  return useQuery({
    queryKey: ['learning-states'],
    queryFn: learningStateService.getStates,
  });
}
