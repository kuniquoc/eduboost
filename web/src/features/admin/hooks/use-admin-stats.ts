import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/features/admin/api/admin.service';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminService.getStats,
  });
}
