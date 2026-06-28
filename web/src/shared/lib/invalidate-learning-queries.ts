import type { QueryClient } from '@tanstack/react-query';

/** Refresh student learning dashboards after practice, tutor, or placement flows. */
export function invalidateLearningQueries(queryClient: QueryClient, classId?: string) {
  queryClient.invalidateQueries({ queryKey: ['learning-states'] });
  queryClient.invalidateQueries({ queryKey: ['student-stats'] });
  queryClient.invalidateQueries({ queryKey: ['student-progress'] });
  queryClient.invalidateQueries({ queryKey: ['user-profile'] });
  queryClient.invalidateQueries({ queryKey: ['enrolled-classes'] });
  if (classId) {
    queryClient.invalidateQueries({ queryKey: ['roadmap', classId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['roadmap'] });
  }
}
