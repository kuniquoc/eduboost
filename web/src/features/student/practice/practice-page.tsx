import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { quizzesService } from '@/services/quizzes.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowRight, CheckCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { QuestionDto, QuizResultDto, SubmitQuizRequest } from '@/types';

interface AnswerState {
  selectedOptionIds: string[];
  fillBlankValue: string;
  startTime: number;
}

export function PracticePage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Map<string, AnswerState>>(new Map());
  const [result, setResult] = useState<QuizResultDto | null>(null);

  const { data: quiz, isLoading } = useQuery({
    queryKey: ['practice-quiz', topicId],
    queryFn: () => quizzesService.getPracticeQuiz(topicId!),
    enabled: !!topicId,
  });

  const questions: QuestionDto[] = quiz?.questions ?? [];

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
    mutationFn: (req: SubmitQuizRequest) => quizzesService.submitPracticeQuiz(topicId!, req),
    onSuccess: (data) => setResult(data),
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
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Result screen
  if (result) {
    const gradeColor = result.percentage >= 70 ? 'text-green-400' : result.percentage >= 50 ? 'text-yellow-400' : 'text-red-400';
    return (
      <div className="mx-auto max-w-lg space-y-6 text-center py-8">
        <CheckCircle className="mx-auto h-16 w-16 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">Kết quả luyện tập</h1>
        <div className={`text-5xl font-bold ${gradeColor}`}>{result.score}/{result.total}</div>
        <p className="text-lg text-muted-foreground">{Math.round(result.percentage)}%</p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>Quay lại</Button>
          <Button onClick={() => {
            setResult(null);
            setCurrent(0);
            setAnswers(new Map());
          }}>Làm lại</Button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-muted-foreground">Không có câu hỏi cho chủ đề này</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Quay lại</Button>
      </div>
    );
  }

  const answer = answers.get(q.id) ?? { selectedOptionIds: [], fillBlankValue: '', startTime: Date.now() };

  const toggleOption = (optId: string) => {
    if (q.type === 'mcq') {
      updateAnswer(q.id, { selectedOptionIds: [optId] });
    } else {
      const ids = answer.selectedOptionIds.includes(optId)
        ? answer.selectedOptionIds.filter((id) => id !== optId)
        : [...answer.selectedOptionIds, optId];
      updateAnswer(q.id, { selectedOptionIds: ids });
    }
  };

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại lộ trình
      </button>

      {/* Progress bar */}
      <Progress value={((current + 1) / questions.length) * 100} className="mb-6 h-1" />

      {/* Question */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <Badge variant="outline">Câu {current + 1}/{questions.length}</Badge>
            <Badge variant="secondary">{q.difficulty}</Badge>
          </div>
          <h2 className="mb-6 text-lg font-medium text-foreground">{q.text}</h2>

          {q.type === 'fill_blank' ? (
            <Input
              placeholder="Nhập câu trả lời..."
              value={answer.fillBlankValue}
              onChange={(e) => updateAnswer(q.id, { fillBlankValue: e.target.value })}
              className="text-lg"
            />
          ) : (
            <div className="space-y-3">
              {q.options.map((opt) => {
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
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrent((c) => c - 1)}
          disabled={current === 0}
        >
          <ArrowLeft className="h-4 w-4" /> Trước
        </Button>

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
  );
}
