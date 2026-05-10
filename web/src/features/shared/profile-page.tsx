import { useAuthStore } from '@/store/auth-store';

export function ProfilePage() {
  const { user } = useAuthStore();

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Hồ sơ</h1>
      {user && (
        <div className="mt-4 space-y-2 text-muted-foreground">
          <p>Tên: {user.name}</p>
          <p>Email: {user.email}</p>
          <p>Vai trò: {user.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}</p>
        </div>
      )}
    </div>
  );
}
