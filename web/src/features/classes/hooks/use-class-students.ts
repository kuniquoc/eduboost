import { useQuery } from '@tanstack/react-query';
import { classesService } from '@/features/classes/api/classes.service';

export function useClassStudents(classId: string, search?: string) {
  return useQuery({
    queryKey: ['class-students', classId, search ?? ''],
    queryFn: () => classesService.getStudents(classId, search || undefined),
  });
}
