import { useQuery } from '@tanstack/react-query';
import { studentsService } from '@/features/students/api/students.service';
import { useAuthStore } from '@/features/auth/auth-store';

export function useStudentStats() {
  const role = useAuthStore((s) => s.user?.role);

  return useQuery({
    queryKey: ['student-stats'],
    queryFn: studentsService.getMyStats,
    enabled: role === 'student',
  });
}
