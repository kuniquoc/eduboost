import { ROUTES } from './constants';

export function getDefaultRouteForRole(role: string): string {
  if (role === 'teacher') return ROUTES.TEACHER_CLASSES;
  if (role === 'admin') return ROUTES.ADMIN_DASHBOARD;
  return ROUTES.STUDENT_DASHBOARD;
}
