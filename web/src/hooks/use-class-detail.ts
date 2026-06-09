import { useQuery } from '@tanstack/react-query';
import { classesService } from '@/services/classes.service';

export function useClassDetail(classId: string | undefined) {
  return useQuery({
    queryKey: ['class-detail', classId],
    queryFn: () => classesService.getClass(classId!),
    enabled: !!classId,
  });
}
