import { useQuery } from '@tanstack/react-query';
import { documentsService } from '@/features/documents/api/documents.service';

const INGEST_POLL_MS = 5000;

export function useMyDocuments() {
  return useQuery({
    queryKey: ['my-documents'],
    queryFn: documentsService.getMyDocuments,
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (!docs?.some((d) => d.status === 'ingesting' || d.status === 'processing')) return false;
      return INGEST_POLL_MS;
    },
  });
}
