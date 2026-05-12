import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { topicsService } from '@/services/topics.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Sparkles, Pencil, Trash2, FileText, Loader2 } from 'lucide-react';
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
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['class-detail', classId] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState('');

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

  const aiEvaluateMutation = useMutation({
    mutationFn: () => topicsService.aiEvaluate(classId),
    onSuccess: () => {
      invalidate();
      toast.success('AI đã đánh giá độ khó');
    },
    onError: () => toast.error('AI đánh giá thất bại'),
  });

  const difficultyMutation = useMutation({
    mutationFn: ({ topicId, difficulty }: { topicId: string; difficulty: 'easy' | 'medium' | 'hard' }) =>
      topicsService.updateDifficulty(classId, topicId, difficulty),
    onSuccess: () => {
      invalidate();
      toast.success('Đã cập nhật độ khó');
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: ({ topicId, visible }: { topicId: string; visible: boolean }) =>
      topicsService.updateVisibility(classId, topicId, visible),
    onSuccess: () => invalidate(),
  });

  const openEdit = (t: TopicSummary) => {
    setEditingId(t.id);
    setName(t.name);
    setDescription('');
    setEditOpen(true);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => aiEvaluateMutation.mutate()}
          disabled={aiEvaluateMutation.isPending}
        >
          {aiEvaluateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          AI Đánh giá độ khó
        </Button>
        <Button size="sm" onClick={() => { setName(''); setDescription(''); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" /> Thêm chủ đề
        </Button>
      </div>

      {!topics.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium text-foreground">Chưa có chủ đề</p>
          <p className="mt-1 text-sm text-muted-foreground">Thêm chủ đề để bắt đầu tổ chức nội dung</p>
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
                        {t.aiEvaluated && (
                          <Badge variant="outline"><Sparkles className="h-3 w-3 mr-1" />AI</Badge>
                        )}
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
                          className={`rounded px-2 py-0.5 text-xs transition-colors ${
                            t.difficulty === d
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {difficultyMap[d].label}
                        </button>
                      ))}
                    </div>
                    {/* Doc visibility toggle */}
                    <div className="flex items-center gap-1.5" title="Hiển thị tài liệu cho học sinh">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <Switch
                        checked={t.isDocumentVisible}
                        onCheckedChange={(v) => visibilityMutation.mutate({ topicId: t.id, visible: v })}
                      />
                    </div>
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
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Giới hạn hàm số" required />
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
