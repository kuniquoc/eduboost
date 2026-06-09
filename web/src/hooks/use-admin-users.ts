import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';

export function useAdminUsers(search: string, roleFilter: string) {
  return useQuery({
    queryKey: ['admin-users', search, roleFilter],
    queryFn: () =>
      adminService.getUsers(
        search || undefined,
        roleFilter !== 'all' ? roleFilter : undefined,
      ),
  });
}
