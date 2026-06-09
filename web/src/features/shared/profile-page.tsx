import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { authService } from '@/services/auth.service';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useStudentStats } from '@/hooks/use-student-stats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Mail,
  ShieldCheck,
  BookOpen,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const levelLabel: Record<string, string> = {
  beginner: 'Sơ cấp',
  intermediate: 'Trung cấp',
  advanced: 'Nâng cao',
};

const levelColor: Record<string, string> = {
  beginner: 'bg-green-500/10 text-green-400 border-green-500/30',
  intermediate: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  advanced: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name ?? '');

  const { data: profile, isLoading: loadingProfile } = useUserProfile();
  const isStudent = user?.role === 'student';
  const { data: stats } = useStudentStats();

  const roleLabel =
    user?.role === 'teacher'
      ? 'Giáo viên'
      : user?.role === 'admin'
        ? 'Quản trị viên'
        : 'Học sinh';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hồ sơ cá nhân</h1>
        <p className="mt-1 text-sm text-muted-foreground">Thông tin tài khoản và tiến độ học tập</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Account info card */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Thông tin tài khoản</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2">
                {user?.avatar?.startsWith('http') ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary">
                    {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                  </div>
                )}
                <label className="cursor-pointer text-xs text-primary hover:underline">
                  Đổi ảnh đại diện
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const updated = await authService.uploadAvatar(file);
                        updateUser(updated);
                        toast.success('Cập nhật ảnh đại diện thành công');
                      } catch {
                        toast.error('Không thể tải ảnh lên');
                      }
                    }}
                  />
                </label>
              </div>

              {/* Name */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Tên hiển thị
                </Label>
                {editingName ? (
                  <div className="flex gap-2">
                    <Input
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-500"
                      onClick={async () => {
                        const trimmed = nameInput.trim();
                        if (!trimmed) {
                          toast.error('Tên không được để trống');
                          return;
                        }
                        try {
                          const updated = await authService.updateName(trimmed);
                          updateUser(updated);
                          setEditingName(false);
                          toast.success('Cập nhật tên thành công');
                        } catch {
                          toast.error('Không thể cập nhật tên');
                        }
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        setNameInput(user?.name ?? '');
                        setEditingName(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{user?.name}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => {
                        setNameInput(user?.name ?? '');
                        setEditingName(true);
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </Label>
                <p className="text-sm text-foreground">{user?.email}</p>
              </div>

              {/* Role */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Vai trò
                </Label>
                <Badge variant="secondary">{roleLabel}</Badge>
              </div>

              {/* Level */}
              {profile?.currentLevel && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Trình độ hiện tại</Label>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      levelColor[profile.currentLevel] ?? 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {levelLabel[profile.currentLevel] ?? profile.currentLevel}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Stats */}
        <div className="lg:col-span-2 space-y-4">
          {loadingProfile ? (
            <Card className="h-20 animate-pulse border-border bg-card" />
          ) : (
            <>
              {isStudent && (
                <StatCard
                  icon={BookOpen}
                  label="Bài quiz đã làm"
                  value={stats?.totalQuizzesTaken ?? 0}
                />
              )}

              {!isStudent && user?.createdAt && (
                <StatCard
                  icon={ShieldCheck}
                  label="Tham gia từ"
                  value={new Date(user.createdAt).toLocaleDateString('vi-VN')}
                />
              )}

              {isStudent && user?.createdAt && (
                <p className="text-xs text-muted-foreground">
                  Tham gia từ: {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                </p>
              )}

              {/* Preferred topics */}
              {profile?.preferredTopics && profile.preferredTopics.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Chủ đề yêu thích</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {profile.preferredTopics.map((topic) => (
                        <Badge key={topic} variant="secondary">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Last active */}
              {profile?.lastActiveDate && (
                <p className="text-xs text-muted-foreground">
                  Hoạt động lần cuối: {new Date(profile.lastActiveDate).toLocaleDateString('vi-VN')}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
