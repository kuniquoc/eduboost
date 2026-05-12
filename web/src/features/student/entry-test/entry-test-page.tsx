import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quizzesService } from '@/services/quizzes.service';
import { roadmapService } from '@/services/roadmap.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowRight, CheckCircle, Clock, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { QuestionDto, QuizResultDto, SubmitQuizRequest } from '@/types';

interface AnswerState {
  selectedOptionIds: string[];
  fillBlankValue: string;
  startTime: number;
}

function QuestionView({
  question,
  index,
  total,
  answer,
  onAnswer,
}: {
  question: QuestionDto;
  index: number;
  total: number;
  answer: AnswerState;
  onAnswer: (a: Partial<AnswerState>) => void;
}) {
  const toggleOption = (optId: string) => {
    if (question.type === 'mcq') {
      onAnswer({ selectedOptionIds: [optId] });
    } else {
      const ids = answer.selectedOptionIds.includes(optId)
        ? answer.selectedOptionIds.filter((id) => id !== optId)
        : [...answer.selectedOptionIds, optId];
      onAnswer({ selectedOptionIds: ids });
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Badge variant="outline">Câu {index + 1}/{total}</Badge>
        <Badge variant="secondary">{question.difficulty}</Badge>
      </div>
      <h2 className="mb-6 text-lg font-medium text-foreground">{question.text}</h2>

      {question.type === 'fill_blank' ? (
        <Input
          placeholder="Nhập câu trả lời..."
          value={answer.fillBlankValue}
          onChange={(e) => onAnswer({ fillBlankValue: e.target.value })}
          className="text-lg"
        />
      ) : (
        <div className="space-y-3">
          {question.options.map((opt) => {
            const selected = answer.selectedOptionIds.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleOption(opt.id)}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  selected
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="text-sm">{opt.text}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResultView({ result, onBack }: { result: QuizResultDto; onBack: () => void }) {
  const gradeColor = result.percentage >= 70 ? 'text-green-400' : result.percentage >= 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <CheckCircle className="mx-auto h-16 w-16 text-primary" />
      <h1 className="text-3xl font-bold text-foreground">Kết quả bài test</h1>
      <div className={`text-5xl font-bold ${gradeColor}`}>
        {result.score}/{result.total}
      </div>
      <p className="text-lg text-muted-foreground">{Math.round(result.percentage)}% — {result.grade}</p>

      {result.topicScores?.length > 0 && (
        <Card className="border-border text-left">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-foreground">Điểm theo chủ đề</h3>
            {result.topicScores.map((ts) => (
              <div key={ts.topicId}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{ts.topicName}</span>
                  <span className="text-muted-foreground">{ts.score}/{ts.total}</span>
                </div>
                <Progress value={ts.percentage} className="mt-1 h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Button onClick={onBack} className="mt-4">
        Xem lộ trình học tập
      </Button>
    </div>
  );
}

export function EntryTestPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Map<string, AnswerState>>(new Map());
  const [result, setResult] = useState<QuizResultDto | null>(null);

  const { data: test, isLoading } = useQuery({
    queryKey: ['entry-test', classId],
    queryFn: () => quizzesService.getEntryTest(classId!),
    enabled: !!classId,
  });

  const questions = test?.questions ?? [];

  // Initialize answers
  useEffect(() => {
    if (questions.length && answers.size === 0) {
      const map = new Map<string, AnswerState>();
      questions.forEach((q) => {
        map.set(q.id, { selectedOptionIds: [], fillBlankValue: '', startTime: Date.now() });
      });
      setAnswers(map);
    }
  }, [questions, answers.size]);

  const updateAnswer = useCallback((qId: string, partial: Partial<AnswerState>) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      const existing = next.get(qId)!;
      next.set(qId, { ...existing, ...partial });
      return next;
    });
  }, []);

  const submitMutation = useMutation({
    mutationFn: (req: SubmitQuizRequest) => quizzesService.submitEntryTest(classId!, req),
    onSuccess: async (data) => {
      setResult(data);
      // Generate roadmap after entry test submission
      try {
        await roadmapService.generateRoadmap(classId!, data.quizId);
        queryClient.invalidateQueries({ queryKey: ['roadmap', classId] });
        queryClient.invalidateQueries({ queryKey: ['student-progress'] });
      } catch { /* roadmap generation is best-effort */ }
    },
    onError: () => toast.error('Nộp bài thất bại'),
  });

  const handleSubmit = () => {
    const now = Date.now();
    const submitAnswers = questions.map((q) => {
      const a = answers.get(q.id)!;
      return {
        questionId: q.id,
        selectedOptionIds: a.selectedOptionIds,
        fillBlankValue: a.fillBlankValue || undefined,
        timeSpentSeconds: Math.round((now - a.startTime) / 1000),
      };
    });
    submitMutation.mutate({ answers: submitAnswers });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-background p-6">
        <ResultView result={result} onBack={() => navigate(`/student/roadmap/${classId}`)} />
      </div>
    );
  }

  const q = questions[current];
  if (!q) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background gap-4">
        <p className="text-lg font-medium text-foreground">Chưa có bài test đầu vào</p>
        <p className="text-sm text-muted-foreground">Giáo viên chưa tạo bài test cho lớp này. Bạn có thể xem lộ trình hoặc quay lại sau.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/student/classes')}>Quay lại</Button>
          <Button onClick={() => navigate(`/student/roadmap/${classId}`)}>Xem lộ trình</Button>
        </div>
      </div>
    );
  }

  const answeredCount = Array.from(answers.values()).filter(
    (a) => a.selectedOptionIds.length > 0 || a.fillBlankValue.trim(),
  ).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-6 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-foreground">{test?.className}</h1>
            <p className="text-xs text-muted-foreground">Bài test đầu vào</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">
              <Clock className="mr-1 h-3 w-3" />
              {answeredCount}/{questions.length} đã trả lời
            </Badge>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mx-auto max-w-2xl px-6 pt-4">
        <Progress value={((current + 1) / questions.length) * 100} className="h-1" />
      </div>

      {/* Question */}
      <div className="mx-auto max-w-2xl px-6 py-8">
        <QuestionView
          question={q}
          index={current}
          total={questions.length}
          answer={answers.get(q.id) ?? { selectedOptionIds: [], fillBlankValue: '', startTime: Date.now() }}
          onAnswer={(a) => updateAnswer(q.id, a)}
        />
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur px-6 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrent((c) => c - 1)}
            disabled={current === 0}
          >
            <ArrowLeft className="h-4 w-4" /> Trước
          </Button>

          {/* Dots navigator */}
          <div className="hidden sm:flex gap-1">
            {questions.map((qq, i) => {
              const a = answers.get(qq.id);
              const answered = a && (a.selectedOptionIds.length > 0 || a.fillBlankValue.trim());
              return (
                <button
                  key={qq.id}
                  onClick={() => setCurrent(i)}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                    i === current
                      ? 'bg-primary'
                      : answered
                        ? 'bg-primary/40'
                        : 'bg-muted'
                  }`}
                />
              );
            })}
          </div>

          {current < questions.length - 1 ? (
            <Button onClick={() => setCurrent((c) => c + 1)}>
              Tiếp <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? 'Đang nộp...' : <><Send className="h-4 w-4" /> Nộp bài</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
