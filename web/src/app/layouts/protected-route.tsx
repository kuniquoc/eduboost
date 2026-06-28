import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth-store';
import type { UserRole } from '@/features/auth/types';

interface Props {
  role?: UserRole;
}

export function ProtectedRoute({ role }: Props) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && user?.role !== role) {
    const redirectMap: Record<string, string> = {
      teacher: '/teacher/classes',
      student: '/student/dashboard',
      admin: '/admin/dashboard',
    };
    const redirectTo = redirectMap[user?.role ?? 'student'] ?? '/student/dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
