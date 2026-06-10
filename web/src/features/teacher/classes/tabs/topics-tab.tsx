import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { topicsService } from '@/services/topics.service';
import { documentsService } from '@/services/documents.service';
import { useClassDocuments } from '@/hooks/use-class-documents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { teacherQuizPoolGeneratePath } from '@/lib/constants';
import { Plus, Pencil, Trash2, FileText, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TopicSummary } from '@/types';

const difficultyMap = {
  easy: { label: 'Dễ', variant: 'secondary' as const },
  medium: { label: 'Trung bình', variant: 'default' as const },
  hard: { label: 'Khó', variant: 'destructive' as const },
};

interface TopicsTabProps {
  classId: string;
  topics: TopicSummary[];
}

export function TopicsTab({ classId, topics }: TopicsTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['class-detail', classId] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState('');

  // Document management dialog state
  const [docManageTopic, setDocManageTopic] = useState<TopicSummary | null>(null);

  const createMutation = useMutation({
    mutationFn: () => topicsService.createTopic(classId, { name, description }),
    onSuccess: () => {
      invalidate();
      toast.success('Đã tạo chủ đề');
      setCreateOpen(false);
      setName('');
      setDescription('');
    },
    onError: () => toast.error('Tạo thất bại'),
  });

  const updateMutation = useMutation({
    mutationFn: () => topicsService.updateTopic(classId, editingId, { name, description }),
    onSuccess: () => {
      invalidate();
      toast.success('Đã cập nhật');
      setEditOpen(false);
    },
    onError: () => toast.error('Cập nhật thất bại'),
  });

  const deleteMutation = useMutation({
    mutationFn: (topicId: string) => topicsService.deleteTopic(classId, topicId),
    onSuccess: () => {
      invalidate();
      toast.success('Đã xóa chủ đề');
      setDeleteId(null);
    },
    onError: () => toast.error('Xóa thất bại'),
  });

  const difficultyMutation = useMutation({
    mutationFn: ({ topicId, difficulty }: { topicId: string; difficulty: 'easy' | 'medium' | 'hard' }) =>
      topicsService.updateDifficulty(classId, topicId, difficulty),
    onSuccess: () => {
      invalidate();
      toast.success('Đã cập nhật độ khó');
    },
  });

  const openEdit = (t: TopicSummary) => {
    setEditingId(t.id);
    setName(t.name);
    setDescription('');
    setEditOpen(true);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => { setName(''); setDescription(''); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" /> Thêm chủ đề
        </Button>
      </div>

      {!topics.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium text-foreground">Chưa có chủ đề</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thêm chủ đề rồi dùng AI sinh câu hỏi — không cần upload tài liệu
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((t) => {
            const diff = difficultyMap[t.difficulty];
            return (
              <Card key={t.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{t.name}</span>
                        <Badge variant={diff.variant}>{diff.label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.questionCount} câu hỏi
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Difficulty selector */}
                    <div className="flex gap-1">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => difficultyMutation.mutate({ topicId: t.id, difficulty: d })}
                          className={`rounded px-2 py-0.5 text-xs transition-colors ${t.difficulty === d
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                        >
                          {difficultyMap[d].label}
                        </button>
                      ))}
                    </div>
                    {/* Document management button */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Quản lý tài liệu liên kết"
                      onClick={() => setDocManageTopic(t)}
                    >
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="AI sinh câu hỏi trong Quiz Pool"
                      onClick={() => navigate(teacherQuizPoolGeneratePath({ classId, topicId: t.id }))}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Document management dialog */}
      {docManageTopic && (
        <DocumentManageDialog
          classId={classId}
          topic={docManageTopic}
          onClose={() => setDocManageTopic(null)}
        />
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm chủ đề</DialogTitle>
            <DialogDescription>Tạo chủ đề mới cho lớp học</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Tên chủ đề</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Ngữ pháp" required />
            </div>
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
                {createMutation.isPending ? 'Đang tạo...' : 'Tạo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa chủ đề</DialogTitle>
            <DialogDescription>Cập nhật thông tin chủ đề</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Tên chủ đề</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa chủ đề</DialogTitle>
            <DialogDescription>Hành động này không thể hoàn tác. Tất cả câu hỏi liên quan cũng sẽ bị xóa.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
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

// ── Sub-component: Document management dialog ───────────────────────────────

interface DocumentManageDialogProps {
  classId: string;
  topic: TopicSummary;
  onClose: () => void;
}

function DocumentManageDialog({ classId, topic, onClose }: DocumentManageDialogProps) {
  const queryClient = useQueryClient();
  const { data: documents, isLoading } = useClassDocuments(classId);
  const invalidateDocs = () => queryClient.invalidateQueries({ queryKey: ['class-documents', classId] });

  const updateTopicMutation = useMutation({
    mutationFn: ({ docId, topicId }: { docId: string; topicId: string | null }) =>
      documentsService.updateDocumentTopic(classId, docId, topicId),
    onSuccess: () => invalidateDocs(),
    onError: () => toast.error('Cập nhật thất bại'),
  });

  const linkedDocs = documents?.filter((d) => d.topicId === topic.id) ?? [];
  const unlinkedDocs = documents?.filter((d) => !d.topicId || d.topicId !== topic.id) ?? [];

  const handleToggle = (docId: string, currentlyLinked: boolean) => {
    updateTopicMutation.mutate({
      docId,
      topicId: currentlyLinked ? null : topic.id,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tài liệu liên kết — {topic.name}</DialogTitle>
          <DialogDescription>
            Chọn tài liệu thuộc chủ đề này. Học sinh sẽ thấy tài liệu nếu bạn publish nó ở tab Tài liệu.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !documents?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Lớp chưa có tài liệu nào.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
            {/* Linked docs first */}
            {linkedDocs.map((doc) => (
              <DocumentRow
                key={doc.id}
                name={doc.name}
                linked
                pending={updateTopicMutation.isPending}
                onToggle={() => handleToggle(doc.id, true)}
              />
            ))}
            {/* Unlinked docs */}
            {unlinkedDocs.map((doc) => (
              <DocumentRow
                key={doc.id}
                name={doc.name}
                linked={false}
                pending={updateTopicMutation.isPending}
                onToggle={() => handleToggle(doc.id, false)}
              />
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DocumentRowProps {
  name: string;
  linked: boolean;
  pending: boolean;
  onToggle: () => void;
}

function DocumentRow({ name, linked, pending, onToggle }: DocumentRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-60 ${
        linked ? 'border-primary/40 bg-primary/5' : 'border-border'
      }`}
    >
      <FileText className={`h-4 w-4 shrink-0 ${linked ? 'text-primary' : 'text-muted-foreground'}`} />
      <span className="flex-1 truncate">{name}</span>
      <span className={`text-xs font-medium shrink-0 ${linked ? 'text-primary' : 'text-muted-foreground'}`}>
        {linked ? 'Đã liên kết' : 'Chưa liên kết'}
      </span>
    </button>
  );
}
