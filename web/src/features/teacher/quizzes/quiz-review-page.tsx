import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quizzesService } from '@/services/quizzes.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Trash2, Pencil, CheckCircle, Send, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { QuestionDto, UpdateQuestionPayload, CreateQuestionPayload } from '@/types';

const diffBadge = {
  easy: { label: 'Dễ', variant: 'secondary' as const },
  medium: { label: 'TB', variant: 'default' as const },
  hard: { label: 'Khó', variant: 'destructive' as const },
};

export function QuizReviewPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editQ, setEditQ] = useState<QuestionDto | null>(null);
  const [editText, setEditText] = useState('');
  const [editExplanation, setEditExplanation] = useState('');
  const [editOptions, setEditOptions] = useState<Array<{ id?: string; text: string; isCorrect: boolean }>>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState('');
  const [addExplanation, setAddExplanation] = useState('');
  const [addType, setAddType] = useState<'mcq' | 'multi_select' | 'fill_blank'>('mcq');
  const [addDifficulty, setAddDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [addOptions, setAddOptions] = useState([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);
  const [addCorrectAnswer, setAddCorrectAnswer] = useState('');

  const { data: questions, isLoading } = useQuery({
    queryKey: ['quiz-questions', quizId],
    queryFn: () => quizzesService.getQuestions(quizId!),
    enabled: !!quizId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['quiz-questions', quizId] });

  const verifyMutation = useMutation({
    mutationFn: ({ qId, verified }: { qId: string; verified: boolean }) =>
      quizzesService.verifyQuestion(quizId!, qId, verified),
    onSuccess: () => invalidate(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ qId, data }: { qId: string; data: UpdateQuestionPayload }) =>
      quizzesService.updateQuestion(quizId!, qId, data),
    onSuccess: () => {
      invalidate();
      toast.success('Đã cập nhật câu hỏi');
      setEditQ(null);
    },
    onError: () => toast.error('Cập nhật thất bại'),
  });

  const deleteMutation = useMutation({
    mutationFn: (qId: string) => quizzesService.deleteQuestion(quizId!, qId),
    onSuccess: () => {
      invalidate();
      toast.success('Đã xóa câu hỏi');
      setDeleteId(null);
    },
    onError: () => toast.error('Xóa thất bại'),
  });

  const addMutation = useMutation({
    mutationFn: (data: CreateQuestionPayload) => quizzesService.addQuestion(quizId!, data),
    onSuccess: () => {
      invalidate();
      toast.success('Đã thêm câu hỏi');
      resetAdd();
    },
    onError: () => toast.error('Thêm câu hỏi thất bại'),
  });

  const resetAdd = () => {
    setAddOpen(false);
    setAddText('');
    setAddExplanation('');
    setAddType('mcq');
    setAddDifficulty('medium');
    setAddCorrectAnswer('');
    setAddOptions([
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ]);
  };

  const handleAddQuestion = () => {
    if (!addText.trim()) return;
    addMutation.mutate({
      text: addText,
      type: addType,
      difficulty: addDifficulty,
      explanation: addExplanation || undefined,
      correctAnswer: addType === 'fill_blank' ? addCorrectAnswer : undefined,
      options: addType !== 'fill_blank' ? addOptions.filter((o) => o.text.trim()) : [],
    });
  };

  const publishMutation = useMutation({
    mutationFn: () => quizzesService.publishQuiz(quizId!),
    onSuccess: () => {
      toast.success('Đã xuất bản quiz!');
      navigate(-1);
    },
    onError: () => toast.error('Xuất bản thất bại'),
  });

  const openEdit = (q: QuestionDto) => {
    setEditQ(q);
    setEditText(q.text);
    setEditExplanation(q.explanation ?? '');
    setEditOptions(q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })));
  };

  const handleSaveEdit = () => {
    if (!editQ) return;
    updateMutation.mutate({
      qId: editQ.id,
      data: { text: editText, explanation: editExplanation, options: editOptions },
    });
  };

  const verifiedCount = questions?.filter((q) => q.verifiedByTeacher).length ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="h-32 animate-pulse border-border bg-card" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Studio — Kiểm duyệt Quiz</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {verifiedCount}/{questions?.length ?? 0} câu đã duyệt
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Thêm câu hỏi
            </Button>
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || !questions?.length}
            >
              {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Xuất bản
            </Button>
          </div>
        </div>
      </div>

      {/* Questions list */}
      <div className="space-y-3">
        {questions?.map((q, idx) => {
          const diff = diffBadge[q.difficulty];
          return (
            <Card key={q.id} className="border-border">
              <CardContent className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{q.text}</p>
                      {q.explanation && (
                        <p className="mt-1 text-xs text-muted-foreground italic">💡 {q.explanation}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={diff.variant}>{diff.label}</Badge>
                    <Badge variant="outline">{q.type}</Badge>
                  </div>
                </div>

                {/* Options */}
                <div className="ml-9 mb-3 space-y-1">
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

                {/* Actions */}
                <div className="ml-9 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`h-4 w-4 ${q.verifiedByTeacher ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <Switch
                      checked={q.verifiedByTeacher}
                      onCheckedChange={(v) => verifyMutation.mutate({ qId: q.id, verified: v })}
                    />
                    <span className="text-xs text-muted-foreground">
                      {q.verifiedByTeacher ? 'Đã duyệt' : 'Chưa duyệt'}
                    </span>
                  </div>
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(q)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(q.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
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
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa câu hỏi</DialogTitle>
            <DialogDescription>Bạn có chắc muốn xóa câu hỏi này?</DialogDescription>
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

      {/* Add question dialog */}
      <Dialog open={addOpen} onOpenChange={(v) => { if (!v) resetAdd(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm câu hỏi mới</DialogTitle>
            <DialogDescription>Thêm câu hỏi vào quiz</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Câu hỏi</Label>
              <Textarea value={addText} onChange={(e) => setAddText(e.target.value)} rows={3} placeholder="Nhập nội dung câu hỏi..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Loại câu hỏi</Label>
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value as typeof addType)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="mcq">Trắc nghiệm</option>
                  <option value="multi_select">Nhiều đáp án</option>
                  <option value="fill_blank">Điền khuyết</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Độ khó</Label>
                <select
                  value={addDifficulty}
                  onChange={(e) => setAddDifficulty(e.target.value as typeof addDifficulty)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="easy">Dễ</option>
                  <option value="medium">Trung bình</option>
                  <option value="hard">Khó</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Giải thích (tùy chọn)</Label>
              <Textarea value={addExplanation} onChange={(e) => setAddExplanation(e.target.value)} rows={2} placeholder="Giải thích đáp án..." />
            </div>
            {addType === 'fill_blank' ? (
              <div className="space-y-2">
                <Label>Đáp án đúng</Label>
                <Input value={addCorrectAnswer} onChange={(e) => setAddCorrectAnswer(e.target.value)} placeholder="Nhập đáp án đúng..." />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Đáp án</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddOptions([...addOptions, { text: '', isCorrect: false }])}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Thêm
                  </Button>
                </div>
                {addOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={opt.isCorrect}
                      onChange={(e) => {
                        const updated = [...addOptions];
                        updated[i] = { ...opt, isCorrect: e.target.checked };
                        setAddOptions(updated);
                      }}
                      className="accent-primary"
                    />
                    <Input
                      value={opt.text}
                      onChange={(e) => {
                        const updated = [...addOptions];
                        updated[i] = { ...opt, text: e.target.value };
                        setAddOptions(updated);
                      }}
                      className="flex-1"
                      placeholder={`Đáp án ${String.fromCharCode(65 + i)}`}
                    />
                    {addOptions.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setAddOptions(addOptions.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAdd}>Hủy</Button>
            <Button onClick={handleAddQuestion} disabled={addMutation.isPending || !addText.trim()}>
              {addMutation.isPending ? 'Đang thêm...' : 'Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
