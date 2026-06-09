import { useQuery } from '@tanstack/react-query';
import { studentsService } from '@/services/students.service';
import { useAuthStore } from '@/store/auth-store';

export function useStudentStats() {
  const role = useAuthStore((s) => s.user?.role);

  return useQuery({
    queryKey: ['student-stats'],
    queryFn: studentsService.getMyStats,
    enabled: role === 'student',
  });
}
