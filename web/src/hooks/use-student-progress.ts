import { useQuery } from '@tanstack/react-query';
import { studentsService } from '@/services/students.service';

export function useStudentProgress() {
  return useQuery({
    queryKey: ['student-progress'],
    queryFn: studentsService.getMyProgress,
  });
}
