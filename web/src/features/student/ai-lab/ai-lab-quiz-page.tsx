import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quizzesService } from '@/services/quizzes.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { QuestionDto, UpdateQuestionPayload } from '@/types';

const diffBadge = {
  easy: { label: 'Dễ', variant: 'secondary' as const },
  medium: { label: 'TB', variant: 'default' as const },
  hard: { label: 'Khó', variant: 'destructive' as const },
};

export function AILabQuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editQ, setEditQ] = useState<QuestionDto | null>(null);
  const [editText, setEditText] = useState('');
  const [editExplanation, setEditExplanation] = useState('');
  const [editOptions, setEditOptions] = useState<Array<{ id?: string; text: string; isCorrect: boolean }>>([]);

  const { data: questions, isLoading } = useQuery({
    queryKey: ['my-quiz-questions', quizId],
    queryFn: () => quizzesService.getMyQuizQuestions(quizId!),
    enabled: !!quizId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['my-quiz-questions', quizId] });

  const updateMutation = useMutation({
    mutationFn: ({ qId, data }: { qId: string; data: UpdateQuestionPayload }) =>
      quizzesService.updateMyQuestion(quizId!, qId, data),
    onSuccess: () => {
      invalidate();
      toast.success('Đã cập nhật');
      setEditQ(null);
    },
    onError: () => toast.error('Cập nhật thất bại'),
  });

  const openEdit = (q: QuestionDto) => {
    setEditQ(q);
    setEditText(q.text);
    setEditExplanation(q.explanation ?? '');
    setEditOptions(q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="h-28 animate-pulse border-border bg-card" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate('/student/ai-lab')}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại AI Lab
      </button>

      <h1 className="mb-1 text-2xl font-bold text-foreground">Quiz cá nhân</h1>
      <p className="mb-6 text-sm text-muted-foreground">{questions?.length ?? 0} câu hỏi</p>

      <div className="space-y-3">
        {questions?.map((q, idx) => {
          const diff = diffBadge[q.difficulty];
          return (
            <Card key={q.id} className="border-border">
              <CardContent className="p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-sm font-medium text-foreground">{q.text}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={diff.variant}>{diff.label}</Badge>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(q)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="ml-9 space-y-1">
                  {q.options.map((opt) => (
                    <div
                      key={opt.id}
                      className={`rounded px-2 py-1 text-xs ${
                        opt.isCorrect
                          ? 'bg-green-500/10 text-green-400 font-medium'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {opt.isCorrect ? '✓' : '○'} {opt.text}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <p className="ml-9 mt-2 text-xs text-muted-foreground italic">💡 {q.explanation}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editQ} onOpenChange={() => setEditQ(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa câu hỏi</DialogTitle>
            <DialogDescription>Sửa nội dung và đáp án</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Câu hỏi</Label>
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Giải thích</Label>
              <Textarea value={editExplanation} onChange={(e) => setEditExplanation(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Đáp án</Label>
              {editOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={opt.isCorrect}
                    onChange={(e) => {
                      const updated = [...editOptions];
                      updated[i] = { ...opt, isCorrect: e.target.checked };
                      setEditOptions(updated);
                    }}
                    className="accent-primary"
                  />
                  <Input
                    value={opt.text}
                    onChange={(e) => {
                      const updated = [...editOptions];
                      updated[i] = { ...opt, text: e.target.value };
                      setEditOptions(updated);
                    }}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditQ(null)}>Hủy</Button>
            <Button
              onClick={() => editQ && updateMutation.mutate({
                qId: editQ.id,
                data: { text: editText, explanation: editExplanation, options: editOptions },
              })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
