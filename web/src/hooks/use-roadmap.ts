import { useQuery } from '@tanstack/react-query';
import { roadmapService } from '@/services/roadmap.service';

export function useRoadmap(classId: string | undefined) {
  return useQuery({
    queryKey: ['roadmap', classId],
    queryFn: () => roadmapService.getRoadmap(classId!),
    enabled: !!classId,
  });
}
