import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  GraduationCap,
  BookOpen,
  Database,
  BarChart3,
  UserCog,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AdminUserDto } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function UserRow({ user, onRoleChange }: { user: AdminUserDto; onRoleChange: (userId: string, role: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <p className="font-medium">{user.name}</p>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>
      <div className="flex items-center gap-3">
        <Select value={user.role} onValueChange={(role) => onRoleChange(user.id, role)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="teacher">Teacher</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const queryClient = useQueryClient();

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminService.getStats,
  });

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminService.getUsers(1, 50),
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: string }) => adminService.updateRole(vars.userId, vars.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Đã cập nhật vai trò');
    },
    onError: () => toast.error('Không thể cập nhật vai trò'),
  });

  const handleRoleChange = (userId: string, role: string) => {
    roleMutation.mutate({ userId, role });
  };

  if (loadingStats || loadingUsers) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-20 animate-pulse bg-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Quản trị hệ thống</h1>
        <p className="text-muted-foreground">Tổng quan và quản lý người dùng</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="Tổng người dùng" value={stats.totalUsers} />
          <StatCard icon={GraduationCap} label="Học sinh" value={stats.totalStudents} />
          <StatCard icon={UserCog} label="Giáo viên" value={stats.totalTeachers} />
          <StatCard icon={BookOpen} label="Lớp học" value={stats.totalClasses} />
          <StatCard icon={Database} label="Chủ đề" value={stats.totalTopics} />
          <StatCard icon={BarChart3} label="Câu hỏi" value={stats.totalQuestions} />
        </div>
      )}

      {/* Users list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Quản lý người dùng
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {usersData?.users.map((user) => (
            <UserRow key={user.id} user={user} onRoleChange={handleRoleChange} />
          ))}
          {(!usersData || usersData.users.length === 0) && (
            <p className="text-center text-muted-foreground py-6">Chưa có người dùng</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
