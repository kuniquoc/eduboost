import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsService } from '@/features/documents/api/documents.service';
import { useClassDocuments } from '@/features/documents/hooks/use-class-documents';
import { useClassTopics } from '@/features/classes/hooks/use-class-topics';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent } from '@/shared/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/shared/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { Upload, Download, Trash2, Sparkles, FileText, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import type { DocumentDto } from '@/features/documents/types';
import { teacherQuizPoolGeneratePath } from '@/shared/lib/constants';

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Chờ tải lên', variant: 'outline' },
  uploading: { label: 'Đang tải', variant: 'outline' },
  ingesting: { label: 'Đang index RAG', variant: 'secondary' },
  processing: { label: 'Đang xử lý', variant: 'secondary' },
  ready: { label: 'Sẵn sàng', variant: 'default' },
  ingest_failed: { label: 'Lỗi index RAG', variant: 'destructive' },
  error: { label: 'Lỗi', variant: 'destructive' },
};

function formatSize(size: string) {
  const bytes = parseInt(size);
  if (isNaN(bytes)) return size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsTab({ classId }: { classId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentDto | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: documents, isLoading } = useClassDocuments(classId);
  const { data: topics } = useClassTopics(classId);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['class-documents', classId] });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { uploadUrl, documentId } = await documentsService.requestClassUploadUrl(classId, {
        fileName: file.name,
        fileSize: file.size.toString(),
      });
      await documentsService.uploadFileToMinio(uploadUrl, file);
      await documentsService.confirmClassUpload(classId, documentId);
      invalidate();
      toast.success('Tải lên thành công');
    } catch {
      toast.error('Tải lên thất bại');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => documentsService.deleteClassDocument(classId, docId),
    onSuccess: () => {
      invalidate();
      toast.success('Đã xóa tài liệu');
      setDeleteDoc(null);
    },
    onError: () => toast.error('Xóa thất bại'),
  });

  const retryIngestMutation = useMutation({
    mutationFn: (docId: string) => documentsService.confirmClassUpload(classId, docId),
    onSuccess: () => {
      invalidate();
      toast.success('Đang thử index RAG lại...');
    },
    onError: () => toast.error('Không thể thử lại index RAG'),
  });

  const updateTopicMutation = useMutation({
    mutationFn: ({ docId, topicId }: { docId: string; topicId: string | null }) =>
      documentsService.updateDocumentTopic(classId, docId, topicId),
    onSuccess: () => invalidate(),
    onError: () => toast.error('Cập nhật chủ đề thất bại'),
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: ({ docId, isVisible }: { docId: string; isVisible: boolean }) =>
      documentsService.updateDocumentVisibility(classId, docId, isVisible),
    onSuccess: (_, vars) => {
      invalidate();
      toast.success(vars.isVisible ? 'Đã publish cho học sinh' : 'Đã ẩn khỏi học sinh');
    },
    onError: () => toast.error('Cập nhật thất bại'),
  });

  const handleDownload = async (doc: DocumentDto) => {
    try {
      const { downloadUrl } = await documentsService.getClassDocumentDownloadUrl(classId, doc.id);
      window.open(downloadUrl, '_blank');
    } catch {
      toast.error('Không thể tải xuống');
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{documents?.length ?? 0} tài liệu</p>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.md"
            onChange={handleUpload}
          />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Đang tải...' : 'Tải lên'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-16 animate-pulse border-border bg-card" />
          ))}
        </div>
      ) : !documents?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium text-foreground">Chưa có tài liệu</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload tài liệu để AI tạo bài quiz</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const status = statusMap[doc.status] ?? statusMap.error;
            return (
              <Card key={doc.id} className="border-border">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    {/* Left: file info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground text-sm">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {doc.status === 'ingest_failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryIngestMutation.mutate(doc.id)}
                          disabled={retryIngestMutation.isPending}
                        >
                          Thử lại RAG
                        </Button>
                      )}
                      {(doc.status === 'ready' || doc.status === 'error') && (
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => navigate(teacherQuizPoolGeneratePath({
                            classId,
                            documentId: doc.id,
                            topicId: doc.topicId ?? undefined,
                          }))}
                          title="Sinh quiz AI trong kho câu hỏi"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {doc.generatedQuizId && doc.status !== 'error' && (
                        <Link to={`/teacher/ai-studio/${doc.generatedQuizId}`}>
                          <Badge variant="outline" className="cursor-pointer hover:bg-primary/10">
                            <Sparkles className="h-3 w-3 mr-1" />Xem Quiz
                          </Badge>
                        </Link>
                      )}
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDownload(doc)} title="Tải xuống">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteDoc(doc)} title="Xóa">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Bottom row: topic selector + publish toggle */}
                  <div className="mt-2 flex items-center gap-3 border-t border-border/50 pt-2">
                    {/* Topic selector */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-xs text-muted-foreground shrink-0">Chủ đề:</span>
                      <Select
                        value={doc.topicId ?? 'none'}
                        onValueChange={(v) =>
                          updateTopicMutation.mutate({ docId: doc.id, topicId: v === 'none' ? null : v })
                        }
                      >
                        <SelectTrigger className="h-6 text-xs min-w-0 max-w-[200px]">
                          <span className="truncate">
                            {doc.topicId
                              ? (topics?.find((t) => t.id === doc.topicId)?.name ?? 'Chưa gán')
                              : 'Chưa gán chủ đề'}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Chưa gán chủ đề</SelectItem>
                          {topics?.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Publish toggle */}
                    <div className="flex items-center gap-1.5 shrink-0" title={doc.isVisible ? 'Đang hiển thị cho học sinh' : 'Học sinh chưa thấy tài liệu này'}>
                      {doc.isVisible
                        ? <Eye className="h-3.5 w-3.5 text-green-500" />
                        : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                      <Switch
                        checked={doc.isVisible}
                        onCheckedChange={(v) => updateVisibilityMutation.mutate({ docId: doc.id, isVisible: v })}
                        disabled={updateVisibilityMutation.isPending}
                      />
                      <span className="text-xs text-muted-foreground">
                        {doc.isVisible ? 'Đã publish' : 'Chưa publish'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa tài liệu</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa <strong>{deleteDoc?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDoc(null)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={() => deleteDoc && deleteMutation.mutate(deleteDoc.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
