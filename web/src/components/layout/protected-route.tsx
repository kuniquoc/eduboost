import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import type { UserRole } from '@/types';

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
    const redirectTo = user?.role === 'teacher' ? '/teacher/classes' : '/student/dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
