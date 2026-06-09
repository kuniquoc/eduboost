import { useQuery } from '@tanstack/react-query';
import { classesService } from '@/services/classes.service';

export function useEnrolledClasses() {
  return useQuery({
    queryKey: ['enrolled-classes'],
    queryFn: classesService.getEnrolledClasses,
  });
}
