import { useQuery } from '@tanstack/react-query';
import { studentsService } from '@/services/students.service';

export function useClassAnalytics(classId: string) {
  return useQuery({
    queryKey: ['class-analytics', classId],
    queryFn: () => studentsService.getClassAnalytics(classId),
  });
}
