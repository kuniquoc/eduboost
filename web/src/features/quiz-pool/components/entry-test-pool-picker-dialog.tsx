import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { poolService } from '@/features/quiz-pool/api/pool.service';
import { PoolQuestionPicker } from '@/features/quiz-pool/components/pool-question-picker';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Badge } from '@/shared/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/shared/ui/dialog';
import { FileQuestion, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { QuestionDto, QuizDto } from '@/features/quizzes/types';

const MIN_QUESTIONS = 1;

interface EntryTestPoolPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className?: string;
  onSuccess: (quiz: QuizDto) => void;
}

export function EntryTestPoolPickerDialog({
  open,
  onOpenChange,
  classId,
  className,
  onSuccess,
}: EntryTestPoolPickerDialogProps) {
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Array<QuestionDto & { topicName?: string }>>([]);
  const [title, setTitle] = useState('');

  const summary = useMemo(() => {
    const counts = { easy: 0, medium: 0, hard: 0 };
    const topicCounts: Record<string, { name: string; count: number }> = {};

    for (const q of selectedQuestions) {
      counts[q.difficultyBand]++;
      const tid = q.topicId;
      if (!topicCounts[tid]) {
        topicCounts[tid] = { name: q.topicName ?? tid, count: 0 };
      }
      topicCounts[tid].count++;
    }

    return {
      counts,
      topicLabels: Object.values(topicCounts),
      total: selectedQuestionIds.length,
    };
  }, [selectedQuestions, selectedQuestionIds.length]);

  const createMutation = useMutation({
    mutationFn: () => poolService.createEntryTestFromPool({
      classId,
      title: title.trim() || undefined,
      questionIds: selectedQuestionIds,
    }),
    onSuccess: (quiz) => {
      toast.success('Đã tạo bài test đầu vào từ kho câu hỏi. Hãy kiểm tra và xuất bản!');
      setSelectedQuestionIds([]);
      setSelectedQuestions([]);
      setTitle('');
      onOpenChange(false);
      onSuccess(quiz);
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      toast.error(err.response?.data?.message ?? err.message ?? 'Tạo test đầu vào thất bại');
    },
  });

  const handleSubmit = () => {
    if (selectedQuestionIds.length < MIN_QUESTIONS) {
      toast.error('Cần chọn ít nhất 1 câu hỏi cho bài test đầu vào');
      return;
    }
    if (summary.topicLabels.length < 2) {
      toast.warning('Nên chọn câu hỏi từ ít nhất 2 chủ đề để đánh giá BKT chính xác hơn');
    }
    if (summary.counts.medium === 0) {
      toast.warning('Nên có câu hỏi độ khó trung bình để placement test adaptive hoạt động tốt');
    }
    createMutation.mutate();
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setSelectedQuestionIds([]);
      setSelectedQuestions([]);
      setTitle('');
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileQuestion className="h-5 w-5 text-purple-400" />
            Tạo test đầu vào từ kho câu hỏi
          </DialogTitle>
          <DialogDescription>
            Chọn câu hỏi từ kho pool của lớp{className ? ` "${className}"` : ''}. Độ khó và chủ đề được giữ nguyên để phục vụ BKT/IRT.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Tên bài test (tùy chọn)</Label>
            <Input
              placeholder={className ? `Bài test đầu vào — ${className}` : 'Bài test đầu vào'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted/30"
            />
          </div>

          <PoolQuestionPicker
            classId={classId}
            selectionMode="question"
            selectedQuestionIds={selectedQuestionIds}
            selectedPoolQuizIds={[]}
            onSelectionChange={({ questionIds }) => setSelectedQuestionIds(questionIds)}
            onSelectedQuestionsChange={setSelectedQuestions}
            showDifficultyFilter
            showQuestionSearch
          />

          {selectedQuestionIds.length > 0 && (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-2">
              <p className="text-sm font-semibold">
                Đã chọn {summary.total} câu
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Dễ: {summary.counts.easy}</Badge>
                <Badge variant="outline">TB: {summary.counts.medium}</Badge>
                <Badge variant="outline">Khó: {summary.counts.hard}</Badge>
              </div>
              {summary.topicLabels.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Chủ đề: {summary.topicLabels.map((t) => `${t.name} (${t.count})`).join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Hủy</Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || selectedQuestionIds.length < MIN_QUESTIONS}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {createMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo...</>
              : 'Tạo test đầu vào'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
