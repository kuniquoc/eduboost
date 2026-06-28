import { useQuery } from '@tanstack/react-query';
import { roadmapService } from '@/features/roadmap/api/roadmap.service';

export function useRoadmap(classId: string | undefined) {
  return useQuery({
    queryKey: ['roadmap', classId],
    queryFn: () => roadmapService.getRoadmap(classId!),
    enabled: !!classId,
  });
}
