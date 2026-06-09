import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminStats } from '@/hooks/use-admin-stats';
import { useAdminUsers } from '@/hooks/use-admin-users';
import { adminService } from '@/services/admin.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  GraduationCap,
  BookOpen,
  Database,
  BarChart3,
  UserCog,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AdminUserDto } from '@/types';

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
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

function UserRow({
  user,
  onRoleChange,
  onDelete,
}: {
  user: AdminUserDto;
  onRoleChange: (userId: string, role: string | null) => void;
  onDelete: (user: AdminUserDto) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{user.name}</p>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <p className="text-xs text-muted-foreground">
          Ngày tạo: {new Date(user.createdAt).toLocaleDateString('vi-VN')}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Select value={user.role} onValueChange={(role) => onRoleChange(user.id ?? '', role)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="teacher">Teacher</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(user)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<AdminUserDto | null>(null);

  const { data: stats, isLoading: loadingStats } = useAdminStats();
  const { data: users = [], isLoading: loadingUsers } = useAdminUsers(search, roleFilter);

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: string }) =>
      adminService.updateRole(vars.userId, vars.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('Đã cập nhật vai trò');
    },
    onError: () => toast.error('Không thể cập nhật vai trò'),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => adminService.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setDeleteTarget(null);
      toast.success('Đã xóa tài khoản');
    },
    onError: () => toast.error('Xóa tài khoản thất bại'),
  });

  const handleRoleChange = (userId: string, role: string | null) => {
    if (!userId || !role) {
      toast.error('Dữ liệu vai trò không hợp lệ');
      return;
    }
    roleMutation.mutate({ userId, role });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Quản trị hệ thống</h1>
        <p className="text-muted-foreground">Tổng quan và quản lý người dùng</p>
      </div>

      {/* Stats */}
      {loadingStats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-20 animate-pulse bg-card" />
          ))}
        </div>
      ) : (
        stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard icon={Users} label="Tổng người dùng" value={stats.totalUsers} />
            <StatCard icon={GraduationCap} label="Học sinh" value={stats.totalStudents} />
            <StatCard icon={UserCog} label="Giáo viên" value={stats.totalTeachers} />
            <StatCard icon={BookOpen} label="Lớp học" value={stats.totalClasses} />
            <StatCard icon={Database} label="Chủ đề" value={stats.totalTopics} />
            <StatCard icon={BarChart3} label="Câu hỏi" value={stats.totalQuestions} />
          </div>
        )
      )}

      {/* Users list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Quản lý người dùng
          </CardTitle>
          {/* Search + Filter */}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên hoặc email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v || 'all')}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Lọc vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingUsers ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))
          ) : users.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Không tìm thấy người dùng</p>
          ) : (
            users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                onRoleChange={handleRoleChange}
                onDelete={setDeleteTarget}
              />
            ))
          )}
          {users.length > 0 && (
            <p className="pt-1 text-right text-xs text-muted-foreground">
              {users.length} người dùng
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa tài khoản</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa tài khoản <strong>{deleteTarget?.name}</strong> (
              {deleteTarget?.email})? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id ?? '')}
            >
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa tài khoản'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
