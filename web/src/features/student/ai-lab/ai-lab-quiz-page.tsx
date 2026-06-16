import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMyQuizQuestions } from '@/hooks/use-my-quiz-questions';
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
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
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
  const [editCorrectAnswer, setEditCorrectAnswer] = useState('');
  const [deleteQ, setDeleteQ] = useState<QuestionDto | null>(null);

  const { data: questions, isLoading } = useMyQuizQuestions(quizId);

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

  const deleteMutation = useMutation({
    mutationFn: (qId: string) => quizzesService.deleteMyQuestion(quizId!, qId),
    onSuccess: () => {
      invalidate();
      toast.success('Đã xóa câu hỏi');
      setDeleteQ(null);
    },
    onError: () => toast.error('Xóa thất bại'),
  });

  const openEdit = (q: QuestionDto) => {
    setEditQ(q);
    setEditText(q.text);
    setEditExplanation(q.explanation ?? '');
    setEditOptions(q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })));
    setEditCorrectAnswer(q.correctAnswer ?? '');
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
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteQ(q)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {q.type === 'fill_blank' ? (
                  <div className="ml-9 mt-3 max-w-md">
                    <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500 bg-emerald-50 p-2.5 text-xs text-emerald-800 font-semibold shadow-sm ring-1 ring-emerald-500/20">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-primary-foreground text-[10px] font-bold">✓</span>
                      <div className="flex-1 text-left">
                        <span className="font-normal text-muted-foreground mr-1.5">Đáp án đúng:</span>
                        <span>{q.correctAnswer}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="ml-9 mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-xs transition-all shadow-sm ${
                          opt.isCorrect
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold ring-1 ring-emerald-500/20'
                            : 'bg-muted/30 border-border/60 text-muted-foreground'
                        }`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          opt.isCorrect
                            ? 'bg-emerald-600 text-primary-foreground'
                            : 'bg-muted border border-border text-muted-foreground'
                        }`}>
                          {opt.isCorrect ? '✓' : '○'}
                        </span>
                        <span className="flex-1 font-medium text-left">{opt.text}</span>
                      </div>
                    ))}
                  </div>
                )}
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
            {editQ?.type === 'fill_blank' ? (
              <div className="space-y-2">
                <Label>Đáp án đúng</Label>
                <Input
                  value={editCorrectAnswer}
                  onChange={(e) => setEditCorrectAnswer(e.target.value)}
                  placeholder="Nhập đáp án đúng..."
                />
              </div>
            ) : (
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold">Đáp án (Chọn checkbox bên cạnh đáp án đúng)</Label>
                {editOptions.map((opt, i) => (
                  <div 
                    key={i} 
                    className={`flex items-center gap-3 rounded-lg border p-2 transition-all ${
                      opt.isCorrect 
                        ? 'bg-emerald-500/5 border-emerald-500/40'
                        : 'border-border bg-card'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={opt.isCorrect}
                      onChange={(e) => {
                        const updated = [...editOptions];
                        updated[i] = { ...opt, isCorrect: e.target.checked };
                        setEditOptions(updated);
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                    />
                    <Input
                      value={opt.text}
                      onChange={(e) => {
                        const updated = [...editOptions];
                        updated[i] = { ...opt, text: e.target.value };
                        setEditOptions(updated);
                      }}
                      className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-sm h-8"
                      placeholder={`Đáp án ${String.fromCharCode(65 + i)}`}
                    />
                    {opt.isCorrect && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full select-none shrink-0">
                        Đúng
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditQ(null)}>Hủy</Button>
            <Button
              onClick={() => editQ && updateMutation.mutate({
                qId: editQ.id,
                data: {
                  text: editText,
                  explanation: editExplanation,
                  options: editQ.type === 'fill_blank' ? [] : editOptions,
                  correctAnswer: editQ.type === 'fill_blank' ? editCorrectAnswer : undefined
                },
              })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteQ} onOpenChange={() => setDeleteQ(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa câu hỏi</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa câu hỏi này? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteQ(null)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={() => deleteQ && deleteMutation.mutate(deleteQ.id)}
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
