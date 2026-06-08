import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsService } from '@/services/documents.service';
import { quizzesService } from '@/services/quizzes.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Upload, Trash2, Sparkles, FileText, Download, Loader2, BookOpen, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { QuizBuilderDialog } from '@/components/shared/quiz-builder-dialog';
import { QuizGenerationDialog } from '@/components/shared/quiz-generation-dialog';
import type { DocumentDto, CreateQuestionPayload } from '@/types';

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Chờ tải lên', variant: 'outline' },
  uploading: { label: 'Đang tải', variant: 'outline' },
  processing: { label: 'Đang xử lý', variant: 'secondary' },
  ready: { label: 'Sẵn sàng', variant: 'default' },
  error: { label: 'Lỗi', variant: 'destructive' },
};

function formatSize(size: string) {
  const bytes = parseInt(size);
  if (isNaN(bytes)) return size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AILabPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<DocumentDto | null>(null);
  const [quizBuilderOpen, setQuizBuilderOpen] = useState(false);
  const [quizDoc, setQuizDoc] = useState<DocumentDto | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['my-documents'],
    queryFn: documentsService.getMyDocuments,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['my-documents'] });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { uploadUrl, documentId } = await documentsService.requestStudentUploadUrl({
        fileName: file.name,
        fileSize: file.size.toString(),
      });
      await documentsService.uploadFileToMinio(uploadUrl, file);
      await documentsService.confirmStudentUpload(documentId);
      invalidate();
      toast.success('Tải lên thành công!');
    } catch {
      toast.error('Tải lên thất bại');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => documentsService.deleteMyDocument(docId),
    onSuccess: () => {
      invalidate();
      toast.success('Đã xóa');
      setDeleteDoc(null);
    },
    onError: () => toast.error('Xóa thất bại'),
  });

  const generateMutation = useMutation({
    mutationFn: (data: { docId: string; options?: { numQuestions?: number; difficulty?: string; mode?: string } }) =>
      documentsService.generateMyQuiz(data.docId, data.options),
    onSuccess: () => {
      invalidate();
      toast.success('Đang tạo quiz...');
    },
    onError: () => toast.error('Tạo quiz thất bại'),
  });

  const createMyQuizMutation = useMutation({
    mutationFn: (data: { title: string; questions: CreateQuestionPayload[] }) =>
      quizzesService.createMyQuiz({ title: data.title, questions: data.questions }),
    onSuccess: () => {
      toast.success('Tạo quiz cá nhân thành công');
      setQuizBuilderOpen(false);
    },
    onError: () => toast.error('Tạo quiz thất bại'),
  });

  const handleDownload = async (doc: DocumentDto) => {
    try {
      const { downloadUrl } = await documentsService.getMyDocumentDownloadUrl(doc.id);
      window.open(downloadUrl, '_blank');
    } catch {
      toast.error('Không thể tải xuống');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Lab</h1>
          <p className="mt-1 text-sm text-muted-foreground">Upload tài liệu và tạo quiz với AI</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setQuizBuilderOpen(true)}>
            <PenLine className="h-4 w-4" /> Tạo quiz thủ công
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.md"
            onChange={handleUpload}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Đang tải...' : 'Tải lên tài liệu'}
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium text-foreground">Chưa có tài liệu</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload tài liệu để AI tạo bài quiz cá nhân
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const status = statusMap[doc.status] ?? statusMap.error;
            return (
              <Card key={doc.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatSize(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={status.variant}>{status.label}</Badge>

                    {(doc.status === 'ready' || doc.status === 'error') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuizDoc(doc)}
                        disabled={generateMutation.isPending}
                      >
                        {generateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-1" />
                        )}
                        {doc.status === 'error' ? 'Thử lại' : doc.generatedQuizId ? 'Sinh thêm' : 'Tạo Quiz'}
                      </Button>
                    )}

                    {doc.generatedQuizId && doc.status !== 'error' && (
                      <Link to={`/student/ai-lab/${doc.generatedQuizId}`}>
                        <Badge variant="default" className="cursor-pointer">
                          <Sparkles className="h-3 w-3 mr-1" />Xem Quiz
                        </Badge>
                      </Link>
                    )}

                    <Button variant="ghost" size="icon-sm" onClick={() => handleDownload(doc)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteDoc(doc)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
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
            <DialogDescription>Bạn có chắc muốn xóa <strong>{deleteDoc?.name}</strong>?</DialogDescription>
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

      {/* Quiz Generation Settings Dialog */}
      <QuizGenerationDialog
        open={!!quizDoc}
        onOpenChange={(open) => !open && setQuizDoc(null)}
        doc={quizDoc}
        onSubmit={(options) => {
          if (quizDoc) {
            generateMutation.mutate({ docId: quizDoc.id, options });
            setQuizDoc(null);
          }
        }}
        isPending={generateMutation.isPending}
      />

      {/* Quiz Builder Dialog */}
      <QuizBuilderDialog
        open={quizBuilderOpen}
        onOpenChange={setQuizBuilderOpen}
        onSubmit={(title, questions) => createMyQuizMutation.mutate({ title, questions })}
        isPending={createMyQuizMutation.isPending}
        dialogTitle="Tạo quiz cá nhân"
        dialogDescription="Tự tạo quiz để ôn luyện mà không cần upload tài liệu"
      />
    </div>
  );
}
