import { useQuery } from '@tanstack/react-query';
import { classesService } from '@/features/classes/api/classes.service';

export function useEnrolledClasses() {
  return useQuery({
    queryKey: ['enrolled-classes'],
    queryFn: classesService.getEnrolledClasses,
  });
}
