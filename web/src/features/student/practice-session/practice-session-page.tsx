import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { practiceSessionService } from '@/services/practiceSession.service';
import { invalidateLearningQueries } from '@/lib/invalidate-learning-queries';
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
  Calendar,
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

function milestoneLabel(repetitionCount: number, reviewInterval: number): string {
  if (repetitionCount <= 1) return 'Mốc 1 — ôn lại sau 1 ngày';
  if (repetitionCount === 2) return 'Mốc 2 — ôn lại sau 6 ngày';
  return `Mốc ${repetitionCount} — ôn lại sau ${Math.round(reviewInterval)} ngày`;
}

export function PracticeSessionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const topicId = searchParams.get('topicId') || '';
  const topicName = searchParams.get('topicName') || 'Luyện tập';
  const mode = searchParams.get('mode') || 'standard';
  const isReviewMode = mode === 'review';
  const isFixedMode = mode === 'fixed';
  const autoStartMode = isReviewMode || isFixedMode;
  const questionIdsParam = searchParams.get('questionIds');
  const reviewQuestionIds = questionIdsParam ? questionIdsParam.split(',').filter(Boolean) : undefined;
  const fixedQuestionIds = isFixedMode ? reviewQuestionIds : undefined;

  const [state, setState] = useState<SessionState>({ type: 'idle' });
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const questionStartRef = useRef<number>(Date.now());
  const autoStartedRef = useRef(false);

  const startMutation = useMutation({
    mutationFn: () => {
      if (isReviewMode) return practiceSessionService.startReview(reviewQuestionIds);
      if (isFixedMode) {
        if (!fixedQuestionIds?.length) {
          return Promise.reject(new Error('Missing questionIds'));
        }
        return practiceSessionService.startFixed(fixedQuestionIds, topicId || undefined);
      }
      return practiceSessionService.start(topicId, 10);
    },
    onSuccess: (data) => {
      setTotalQuestions(data.totalQuestions);
      questionStartRef.current = Date.now();
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
      const message = isReviewMode
        ? 'Không thể bắt đầu phiên ôn tập.'
        : isFixedMode
          ? 'Không thể bắt đầu phiên luyện tập từ Quiz Pool.'
          : 'Không thể bắt đầu phiên luyện tập.';
      setState({ type: 'error', message });
      toast.error(message);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (vars: { sessionId: string; questionId: string; selectedOptionIds: string[] }) => {
      const responseTimeSeconds = (Date.now() - questionStartRef.current) / 1000;
      return practiceSessionService.submitAnswer(
        vars.sessionId,
        vars.questionId,
        vars.selectedOptionIds,
        responseTimeSeconds,
      );
    },
    onSuccess: (data, vars) => {
      setState({ type: 'feedback', data, sessionId: vars.sessionId });
    },
    onError: () => toast.error('Lỗi khi gửi câu trả lời'),
  });

  const summaryMutation = useMutation({
    mutationFn: (sessionId: string) => practiceSessionService.endSession(sessionId),
    onSuccess: (data) => {
      invalidateLearningQueries(queryClient);
      setState({ type: 'summary', data });
    },
    onError: () => toast.error('Không tải được kết quả'),
  });

  const handleStart = useCallback(() => {
    setState({ type: 'loading' });
    startMutation.mutate();
  }, [startMutation]);

  useEffect(() => {
    if (autoStartMode && !autoStartedRef.current) {
      autoStartedRef.current = true;
      handleStart();
    }
  }, [autoStartMode, handleStart]);

  useEffect(() => {
    if (!isReviewMode && !isFixedMode && !topicId) {
      navigate('/student/classes', { replace: true });
    }
  }, [isReviewMode, isFixedMode, topicId, navigate]);

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
      questionStartRef.current = Date.now();
      setState({
        type: 'question',
        data,
        question: data.nextQuestion,
        sessionId,
        questionNumber: data.questionNumber,
        total: data.totalQuestions ?? totalQuestions,
      });
    }
  }, [state, summaryMutation, totalQuestions]);

  const toggleOption = (optId: string) => {
    setSelectedOptions((prev) =>
      prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId],
    );
  };

  if (state.type === 'idle' && !autoStartMode) {
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

  if (state.type === 'idle' && autoStartMode) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state.type === 'loading') {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state.type === 'error') {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6 text-center">
        <p className="text-destructive">{state.message}</p>
        <Button onClick={() => (isReviewMode ? navigate('/student/review') : isFixedMode ? navigate('/student/quiz-pool') : setState({ type: 'idle' }))}>
          {isReviewMode ? 'Quay lại ôn tập' : isFixedMode ? 'Quay lại Quiz Pool' : 'Thử lại'}
        </Button>
      </div>
    );
  }

  if (state.type === 'question') {
    const { question, questionNumber, total } = state;
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            {isReviewMode ? 'Ôn tập' : isFixedMode ? 'Quiz Pool' : 'Luyện tập'} — Câu {questionNumber}/{total}
          </Badge>
          <Badge variant="outline">{question.difficulty}</Badge>
        </div>
        <Progress value={(questionNumber / total) * 100} className="h-2" />

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

  if (state.type === 'feedback') {
    const { data } = state;
    const sr = data.spacedRepetition;
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
            {sr && (
              <Badge variant="secondary" className="mx-auto flex w-fit items-center gap-1">
                <Calendar className="h-3 w-3" />
                {milestoneLabel(sr.repetitionCount, sr.reviewInterval)}
              </Badge>
            )}
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

  if (state.type === 'summary') {
    const { data } = state;
    const percentage = Math.round(data.score);
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardHeader className="text-center">
            <Trophy className="mx-auto h-12 w-12 text-yellow-500" />
            <CardTitle>{isReviewMode ? 'Kết quả ôn tập' : isFixedMode ? 'Kết quả Quiz Pool' : 'Kết quả luyện tập'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">{percentage}%</p>
              <p className="text-muted-foreground">
                {data.correctAnswers}/{data.questionsAttempted} câu đúng
              </p>
              {data.masteryChange != null && data.masteryChange !== 0 && (
                <p className="text-sm text-muted-foreground">
                  Thành thạo {data.masteryChange > 0 ? '+' : ''}{Math.round(data.masteryChange * 100)}%
                </p>
              )}
            </div>
            <Progress value={percentage} className="h-3" />
            {data.nextReviewSummary && (
              <p className="rounded-lg bg-primary/5 p-3 text-sm text-primary">{data.nextReviewSummary}</p>
            )}
            {data.recommendation && (
              <p className="rounded-lg bg-muted p-3 text-sm">{data.recommendation}</p>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => (isReviewMode ? navigate('/student/review') : isFixedMode ? navigate('/student/quiz-pool') : navigate(-1))}
              >
                Quay lại
              </Button>
              {!isReviewMode && !isFixedMode && (
                <Button className="flex-1" onClick={() => setState({ type: 'idle' })}>
                  Luyện tiếp
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
