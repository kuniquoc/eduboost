import { useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { practiceSessionService } from '@/services/practiceSession.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Trophy,
  Loader2,
  ArrowRight,
  Brain,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  StartPracticeResponse,
  SubmitPracticeAnswerResponse,
  PracticeSessionSummary,
  PracticeQuestionDto,
} from '@/types';

type SessionState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'question'; data: StartPracticeResponse | SubmitPracticeAnswerResponse; question: PracticeQuestionDto; sessionId: string; questionNumber: number; total: number }
  | { type: 'feedback'; data: SubmitPracticeAnswerResponse; sessionId: string }
  | { type: 'summary'; data: PracticeSessionSummary }
  | { type: 'error'; message: string };

export function PracticeSessionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const topicId = searchParams.get('topicId') || '';
  const topicName = searchParams.get('topicName') || 'Luyện tập';

  const [state, setState] = useState<SessionState>({ type: 'idle' });
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [totalAnswered, setTotalAnswered] = useState(0);

  const startMutation = useMutation({
    mutationFn: () => practiceSessionService.start(topicId, 10),
    onSuccess: (data) => {
      setState({
        type: 'question',
        data,
        question: data.question,
        sessionId: data.sessionId,
        questionNumber: data.questionNumber,
        total: data.totalQuestions,
      });
    },
    onError: () => {
      setState({ type: 'error', message: 'Không thể bắt đầu phiên luyện tập.' });
      toast.error('Không thể bắt đầu phiên luyện tập');
    },
  });

  const submitMutation = useMutation({
    mutationFn: (vars: { sessionId: string; questionId: string; selectedOptionIds: string[] }) =>
      practiceSessionService.submitAnswer(vars.sessionId, vars.questionId, vars.selectedOptionIds),
    onSuccess: (data, vars) => {
      setTotalAnswered((c) => c + 1);
      setState({ type: 'feedback', data, sessionId: vars.sessionId });
    },
    onError: () => toast.error('Lỗi khi gửi câu trả lời'),
  });

  const summaryMutation = useMutation({
    mutationFn: (sessionId: string) => practiceSessionService.endSession(sessionId),
    onSuccess: (data) => setState({ type: 'summary', data }),
    onError: () => toast.error('Không tải được kết quả'),
  });

  const handleStart = useCallback(() => {
    setState({ type: 'loading' });
    startMutation.mutate();
  }, [startMutation]);

  const handleSubmit = useCallback(() => {
    if (state.type !== 'question' || selectedOptions.length === 0) return;
    submitMutation.mutate({
      sessionId: state.sessionId,
      questionId: state.question.questionId,
      selectedOptionIds: selectedOptions,
    });
  }, [state, selectedOptions, submitMutation]);

  const handleNext = useCallback(() => {
    if (state.type !== 'feedback') return;
    const { data, sessionId } = state;
    if (data.isSessionComplete || !data.nextQuestion) {
      summaryMutation.mutate(sessionId);
    } else {
      setSelectedOptions([]);
      setState({
        type: 'question',
        data,
        question: data.nextQuestion,
        sessionId,
        questionNumber: data.questionNumber,
        total: data.totalQuestions ?? totalAnswered + 10,
      });
    }
  }, [state, summaryMutation, totalAnswered]);

  const toggleOption = (optId: string) => {
    setSelectedOptions((prev) =>
      prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId],
    );
  };

  // ── Idle screen ──
  if (state.type === 'idle') {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
        </Button>
        <Card>
          <CardHeader className="text-center">
            <Brain className="mx-auto h-12 w-12 text-primary" />
            <CardTitle className="mt-4">Luyện tập thích ứng</CardTitle>
            <p className="text-muted-foreground">
              Chủ đề: <strong>{topicName}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Hệ thống sẽ chọn câu hỏi phù hợp với trình độ của bạn dựa trên BKT & Spaced Repetition.
            </p>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button size="lg" onClick={handleStart}>
              Bắt đầu luyện tập
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Loading ──
  if (state.type === 'loading') {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Error ──
  if (state.type === 'error') {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6 text-center">
        <p className="text-destructive">{state.message}</p>
        <Button onClick={() => setState({ type: 'idle' })}>Thử lại</Button>
      </div>
    );
  }

  // ── Question ──
  if (state.type === 'question') {
    const { question, questionNumber } = state;
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">Câu {questionNumber}</Badge>
          <Badge variant="outline">{question.difficulty}</Badge>
        </div>
        <Progress value={(totalAnswered / 10) * 100} className="h-2" />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-lg font-medium">{question.text}</p>
            <div className="space-y-2">
              {question.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleOption(opt.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedOptions.includes(opt.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {opt.text}
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={selectedOptions.length === 0 || submitMutation.isPending}
              onClick={handleSubmit}
            >
              {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Xác nhận
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Feedback ──
  if (state.type === 'feedback') {
    const { data } = state;
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardContent className="space-y-4 pt-6 text-center">
            {data.isCorrect ? (
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            ) : (
              <XCircle className="mx-auto h-12 w-12 text-destructive" />
            )}
            <p className="text-lg font-semibold">
              {data.isCorrect ? 'Chính xác!' : 'Chưa đúng'}
            </p>
            {data.explanation && (
              <p className="text-sm text-muted-foreground">{data.explanation}</p>
            )}
            {!data.isCorrect && data.correctAnswer && (
              <p className="text-sm">
                Đáp án đúng: <strong>{data.correctAnswer}</strong>
              </p>
            )}
            <Button className="w-full" onClick={handleNext}>
              {data.isSessionComplete ? 'Xem kết quả' : 'Câu tiếp theo'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Summary ──
  if (state.type === 'summary') {
    const { data } = state;
    const percentage = Math.round(data.score * 100);
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardHeader className="text-center">
            <Trophy className="mx-auto h-12 w-12 text-yellow-500" />
            <CardTitle>Kết quả luyện tập</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">{percentage}%</p>
              <p className="text-muted-foreground">
                {data.correctAnswers}/{data.questionsAttempted} câu đúng
              </p>
            </div>
            <Progress value={percentage} className="h-3" />
            {data.recommendation && (
              <p className="rounded-lg bg-muted p-3 text-sm">{data.recommendation}</p>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => navigate(-1)}>
                Quay lại
              </Button>
              <Button className="flex-1" onClick={() => setState({ type: 'idle' })}>
                Luyện tiếp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
