import { Navigate, useParams } from 'react-router-dom';

export function StudentClassTabRedirect({ tab }: { tab: string }) {
  const { classId } = useParams<{ classId: string }>();
  return <Navigate to={`/student/classes/${classId}?tab=${tab}`} replace />;
}
