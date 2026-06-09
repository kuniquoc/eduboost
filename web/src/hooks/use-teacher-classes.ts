import { useQuery } from '@tanstack/react-query';
import { classesService } from '@/services/classes.service';

export function useTeacherClasses() {
  return useQuery({
    queryKey: ['teacher-classes'],
    queryFn: classesService.getTeacherClasses,
  });
}
