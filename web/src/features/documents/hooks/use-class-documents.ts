import { useQuery } from '@tanstack/react-query';
import { documentsService } from '@/features/documents/api/documents.service';

const INGEST_POLL_MS = 5000;

export function useClassDocuments(classId: string | undefined) {
  return useQuery({
    queryKey: ['class-documents', classId],
    queryFn: () => documentsService.getClassDocuments(classId!),
    enabled: !!classId,
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (!docs?.some((d) => d.status === 'ingesting' || d.status === 'processing')) return false;
      return INGEST_POLL_MS;
    },
  });
}
