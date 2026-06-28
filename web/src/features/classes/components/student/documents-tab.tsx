import { useMutation } from '@tanstack/react-query';
import { documentsService } from '@/features/documents/api/documents.service';
import { useClassDocuments } from '@/features/documents/hooks/use-class-documents';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const statusMap: Record<string, string> = {
  ready: 'Sẵn sàng',
  ingesting: 'Đang xử lý',
  processing: 'Đang xử lý',
  pending: 'Chờ',
};

export function StudentDocumentsTab({ classId }: { classId: string }) {
  const { data: documents = [], isLoading } = useClassDocuments(classId);

  const downloadMutation = useMutation({
    mutationFn: (docId: string) => documentsService.getClassDocumentDownloadUrl(classId, docId),
    onSuccess: (data: { downloadUrl: string }) => {
      window.open(data.downloadUrl, '_blank');
    },
    onError: () => toast.error('Không thể tải tài liệu'),
  });

  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-muted" />;
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
          <FileText className="mb-3 h-10 w-10 opacity-50" />
          <p>Chưa có tài liệu nào được giáo viên chia sẻ.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <Card key={doc.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{doc.name}</p>
              <Badge variant="outline" className="mt-1">
                {statusMap[doc.status] ?? doc.status}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={doc.status !== 'ready' || downloadMutation.isPending}
              onClick={() => downloadMutation.mutate(doc.id)}
            >
              {downloadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Tải xuống
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
