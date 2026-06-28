import { Navigate, useParams } from 'react-router-dom';
import { placementTestPath } from '@/shared/lib/constants';

/** Legacy route — redirects to canonical placement test URL */
export function EntryTestRedirect() {
  const { classId } = useParams<{ classId: string }>();
  if (!classId) return <Navigate to="/student/classes" replace />;
  return <Navigate to={placementTestPath(classId)} replace />;
}
