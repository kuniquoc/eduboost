import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useQuizQuestions } from '@/features/quizzes/hooks/use-quiz-questions';
import { quizzesService } from '@/features/quizzes/api/quizzes.service';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { Badge } from '@/shared/ui/badge';
import { Switch } from '@/shared/ui/switch';
import { Card, CardContent } from '@/shared/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/shared/ui/dialog';
import { ArrowLeft, Trash2, Pencil, CheckCircle, Send, Loader2, Plus, Library } from 'lucide-react';
import { toast } from 'sonner';
import { PoolQuestionPicker } from '@/features/quiz-pool/components/pool-question-picker';
import type { QuestionDto, UpdateQuestionPayload, CreateQuestionPayload } from '@/features/quizzes/types';

const diffBadge: Record<string, { label: string; variant: 'secondary' | 'default' | 'destructive' | 'outline' }> = {
  easy: { label: 'Dễ', variant: 'secondary' },
  medium: { label: 'TB', variant: 'default' },
  hard: { label: 'Khó', variant: 'destructive' },
};

const getDiffBadge = (difficulty: string) => diffBadge[difficulty] ?? { label: difficulty || '?', variant: 'outline' as const };

export function QuizReviewPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editQ, setEditQ] = useState<QuestionDto | null>(null);
  const [poolPickerOpen, setPoolPickerOpen] = useState(false);
  const [selectedPoolQuestionIds, setSelectedPoolQuestionIds] = useState<string[]>([]);

  const { data: quizMeta } = useQuery({
    queryKey: ['quiz-meta', quizId],
    queryFn: () => quizzesService.getQuiz(quizId!),
    enabled: !!quizId,
  });
  const [editText, setEditText] = useState('');
  const [editExplanation, setEditExplanation] = useState('');
  const [editOptions, setEditOptions] = useState<Array<{ id?: string; text: string; isCorrect: boolean }>>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState('');
  const [addExplanation, setAddExplanation] = useState('');
  const [addType, setAddType] = useState<'mcq' | 'multi_select' | 'fill_blank'>('mcq');
  const [editDifficulty, setEditDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [editInitialIrtBeta, setEditInitialIrtBeta] = useState(0);
  const [addDifficulty, setAddDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [addInitialIrtBeta, setAddInitialIrtBeta] = useState<number | ''>('');
  const [addOptions, setAddOptions] = useState([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);
  const [addCorrectAnswer, setAddCorrectAnswer] = useState('');

  const { data: questions, isLoading } = useQuizQuestions(quizId);

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

  const addFromPoolMutation = useMutation({
    mutationFn: (ids: string[]) => quizzesService.addQuestionsFromPool(quizId!, ids),
    onSuccess: (added) => {
      invalidate();
      toast.success(`Đã thêm ${added.length} câu hỏi từ Pool`);
      setPoolPickerOpen(false);
      setSelectedPoolQuestionIds([]);
    },
    onError: () => toast.error('Thêm từ Pool thất bại'),
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
      difficultyBand: addDifficulty,
      initialIrtBeta: addInitialIrtBeta === '' ? undefined : Number(addInitialIrtBeta),
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
    setEditDifficulty(q.difficultyBand || 'medium');
    setEditInitialIrtBeta(q.initialIrtBeta);
  };

  const handleSaveEdit = () => {
    if (!editQ) return;
    updateMutation.mutate({
      qId: editQ.id,
      data: {
        text: editText,
        explanation: editExplanation,
        options: editOptions,
        difficultyBand: editDifficulty,
        initialIrtBeta: editInitialIrtBeta,
      },
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
            <h1 className="text-2xl font-bold text-foreground">Kiểm duyệt Quiz</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {verifiedCount}/{questions?.length ?? 0} câu đã duyệt
            </p>
          </div>
          <div className="flex gap-2">
            {quizMeta?.classId && (
              <Button variant="outline" onClick={() => setPoolPickerOpen(true)}>
                <Library className="h-4 w-4" /> Thêm từ Pool
              </Button>
            )}
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
          const diff = getDiffBadge(q.difficultyBand);
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
                        <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                          <p className="text-xs text-amber-400/90">💡 <span className="font-medium">Giải thích:</span> {q.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={diff.variant}>{diff.label}</Badge>
                    <Badge variant="outline">β {q.irtBeta.toFixed(2)}</Badge>
                    <Badge variant="outline">{q.type}</Badge>
                  </div>
                </div>

                {/* Options */}
                <div className="ml-9 mt-3 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Độ khó</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editDifficulty}
                  onChange={(e) => setEditDifficulty(e.target.value as typeof editDifficulty)}
                >
                  <option value="easy">Dễ</option>
                  <option value="medium">Trung bình</option>
                  <option value="hard">Khó</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Chỉ số β (-3 đến 3)</Label>
                <Input
                  type="number"
                  min={-3}
                  max={3}
                  step={0.1}
                  value={editInitialIrtBeta}
                  onChange={(e) => setEditInitialIrtBeta(Number(e.target.value))}
                />
              </div>
            </div>
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
              <Label>Chỉ số β (-3 đến 3, tùy chọn)</Label>
              <Input
                type="number"
                min={-3}
                max={3}
                step={0.1}
                value={addInitialIrtBeta}
                onChange={(e) => setAddInitialIrtBeta(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Tự map từ độ khó nếu để trống"
              />
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

      {/* Pool picker dialog */}
      {quizMeta?.classId && (
        <Dialog open={poolPickerOpen} onOpenChange={(open) => {
          if (!open) { setPoolPickerOpen(false); setSelectedPoolQuestionIds([]); }
        }}>
          <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Library className="h-5 w-5 text-purple-400" />
                Thêm câu hỏi từ kho câu hỏi
              </DialogTitle>
              <DialogDescription>
                Chọn câu hỏi từ kho pool của lớp để thêm vào quiz này.
              </DialogDescription>
            </DialogHeader>
            <PoolQuestionPicker
              classId={quizMeta.classId}
              selectionMode="question"
              selectedQuestionIds={selectedPoolQuestionIds}
              selectedPoolQuizIds={[]}
              onSelectionChange={({ questionIds }) => setSelectedPoolQuestionIds(questionIds)}
              showDifficultyFilter
              showQuestionSearch
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setPoolPickerOpen(false); setSelectedPoolQuestionIds([]); }}>
                Hủy
              </Button>
              <Button
                onClick={() => addFromPoolMutation.mutate(selectedPoolQuestionIds)}
                disabled={addFromPoolMutation.isPending || selectedPoolQuestionIds.length === 0}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {addFromPoolMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang thêm...</>
                  : `Thêm ${selectedPoolQuestionIds.length > 0 ? selectedPoolQuestionIds.length + ' câu' : ''}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
