import { useQuery } from '@tanstack/react-query';
import { studentsService } from '@/features/students/api/students.service';

export function useStudentProgress() {
  return useQuery({
    queryKey: ['student-progress'],
    queryFn: studentsService.getMyProgress,
  });
}
