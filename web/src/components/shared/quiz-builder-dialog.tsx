import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, GripVertical, Save, Loader2 } from 'lucide-react';
import type { CreateQuestionPayload, QuestionType } from '@/types';

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'Trắc nghiệm' },
  { value: 'multi_select', label: 'Nhiều đáp án' },
  { value: 'fill_blank', label: 'Điền khuyết' },
];

const DIFFICULTIES = [
  { value: 'easy' as const, label: 'Dễ' },
  { value: 'medium' as const, label: 'TB' },
  { value: 'hard' as const, label: 'Khó' },
];

function emptyQuestion(): CreateQuestionPayload {
  return {
    text: '',
    type: 'mcq',
    difficulty: 'medium',
    explanation: '',
    correctAnswer: '',
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
  };
}

interface QuizBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string, questions: CreateQuestionPayload[]) => void;
  isPending: boolean;
  dialogTitle?: string;
  dialogDescription?: string;
}

export function QuizBuilderDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  dialogTitle = 'Tạo quiz thủ công',
  dialogDescription = 'Thêm câu hỏi cho quiz',
}: QuizBuilderDialogProps) {
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<CreateQuestionPayload[]>([emptyQuestion()]);
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const resetForm = () => {
    setTitle('');
    setQuestions([emptyQuestion()]);
    setEditIdx(null);
  };

  const handleClose = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  const updateQuestion = (idx: number, partial: Partial<CreateQuestionPayload>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...partial } : q)));
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    if (editIdx === idx) setEditIdx(null);
  };

  const updateOption = (qIdx: number, oIdx: number, partial: Partial<{ text: string; isCorrect: boolean }>) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const opts = q.options.map((o, j) => (j === oIdx ? { ...o, ...partial } : o));
        return { ...q, options: opts };
      }),
    );
  };

  const addOption = (qIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, options: [...q.options, { text: '', isCorrect: false }] } : q)),
    );
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, options: q.options.filter((_, j) => j !== oIdx) } : q)),
    );
  };

  const handleSubmit = () => {
    const valid = title.trim() && questions.length > 0 && questions.every((q) => {
      if (!q.text.trim()) return false;
      if (q.type === 'fill_blank') return !!q.correctAnswer?.trim();
      return q.options.length >= 2 && q.options.some((o) => o.isCorrect) && q.options.every((o) => o.text.trim());
    });
    if (!valid) return;
    onSubmit(title, questions);
  };

  const isValid = title.trim() && questions.length > 0 && questions.every((q) => {
    if (!q.text.trim()) return false;
    if (q.type === 'fill_blank') return !!q.correctAnswer?.trim();
    return q.options.length >= 2 && q.options.some((o) => o.isCorrect) && q.options.every((o) => o.text.trim());
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Quiz title */}
          <div className="space-y-2">
            <Label>Tiêu đề quiz</Label>
            <Input
              placeholder="VD: Quiz ôn tập chương 1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Questions list */}
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <Card key={idx} className="border-border">
                <CardContent className="p-3">
                  {/* Question header */}
                  <div className="flex items-start gap-2 mb-2">
                    <GripVertical className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">Câu {idx + 1}</Badge>
                        {/* Type selector */}
                        <div className="flex gap-1">
                          {QUESTION_TYPES.map((t) => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => updateQuestion(idx, { type: t.value })}
                              className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                                q.type === t.value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                        {/* Difficulty */}
                        <div className="flex gap-1">
                          {DIFFICULTIES.map((d) => (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => updateQuestion(idx, { difficulty: d.value })}
                              className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                                q.difficulty === d.value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeQuestion(idx)}
                          className="ml-auto text-destructive hover:text-destructive/80"
                          disabled={questions.length <= 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Question text */}
                      <Textarea
                        placeholder="Nhập câu hỏi..."
                        value={q.text}
                        onChange={(e) => updateQuestion(idx, { text: e.target.value })}
                        rows={2}
                        className="text-sm"
                      />

                      {/* Expand/collapse detail */}
                      {editIdx === idx ? (
                        <div className="mt-2 space-y-2">
                          {/* Fill blank: correctAnswer */}
                          {q.type === 'fill_blank' ? (
                            <div className="space-y-1">
                              <Label className="text-xs">Đáp án đúng</Label>
                              <Input
                                placeholder="Nhập đáp án đúng..."
                                value={q.correctAnswer ?? ''}
                                onChange={(e) => updateQuestion(idx, { correctAnswer: e.target.value })}
                                className="text-sm"
                              />
                            </div>
                          ) : (
                            /* MCQ / Multi-select: options */
                            <div className="space-y-1.5">
                              <Label className="text-xs">Đáp án {q.type === 'multi_select' ? '(chọn nhiều)' : '(chọn 1)'}</Label>
                              {q.options.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-2">
                                  <input
                                    type={q.type === 'mcq' ? 'radio' : 'checkbox'}
                                    name={`q-${idx}-correct`}
                                    checked={opt.isCorrect}
                                    onChange={() => {
                                      if (q.type === 'mcq') {
                                        // Radio: only one correct
                                        const opts = q.options.map((o, j) => ({ ...o, isCorrect: j === oi }));
                                        updateQuestion(idx, { options: opts });
                                      } else {
                                        updateOption(idx, oi, { isCorrect: !opt.isCorrect });
                                      }
                                    }}
                                    className="accent-primary"
                                  />
                                  <Input
                                    placeholder={`Đáp án ${String.fromCharCode(65 + oi)}`}
                                    value={opt.text}
                                    onChange={(e) => updateOption(idx, oi, { text: e.target.value })}
                                    className="flex-1 text-sm h-8"
                                  />
                                  {q.options.length > 2 && (
                                    <button type="button" onClick={() => removeOption(idx, oi)} className="text-muted-foreground hover:text-destructive">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {q.options.length < 6 && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => addOption(idx)}>
                                  <Plus className="h-3 w-3" /> Thêm đáp án
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Explanation */}
                          <div className="space-y-1">
                            <Label className="text-xs">Giải thích (tùy chọn)</Label>
                            <Input
                              placeholder="Giải thích đáp án..."
                              value={q.explanation ?? ''}
                              onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                              className="text-sm"
                            />
                          </div>

                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditIdx(null)}>
                            Thu gọn
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditIdx(idx)}
                          className="mt-1 text-xs text-primary hover:underline"
                        >
                          {q.type === 'fill_blank'
                            ? q.correctAnswer ? `Đáp án: ${q.correctAnswer}` : 'Thêm đáp án...'
                            : `${q.options.filter((o) => o.text).length} đáp án · Nhấn để chỉnh sửa`}
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add question button */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setQuestions((prev) => [...prev, emptyQuestion()]);
              setEditIdx(questions.length);
            }}
          >
            <Plus className="h-4 w-4" /> Thêm câu hỏi
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={isPending || !isValid}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isPending ? 'Đang tạo...' : `Tạo quiz (${questions.length} câu)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
