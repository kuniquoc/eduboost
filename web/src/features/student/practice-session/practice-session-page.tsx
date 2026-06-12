import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { practiceSessionService } from '@/services/practiceSession.service';
import { quizzesService } from '@/services/quizzes.service';
import { invalidateLearningQueries } from '@/lib/invalidate-learning-queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { QuizAnswerFeedback } from '@/components/quiz/quiz-answer-feedback';
import {
  ArrowLeft,
  Trophy,
  Loader2,
  Brain,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  SubmitPracticeAnswerResponse,
  PracticeSessionSummary,
  PracticeQuestionDto,
  QuizReviewItemDto,
} from '@/types';

type SessionState =
  | { type: 'idle' }
  | { type: 'loading' }
  | {
      type: 'answering';
      sessionId: string;
      question: PracticeQuestionDto;
      questionNumber: number;
      total: number;
      phase: 'selecting' | 'reviewing';
      feedback?: SubmitPracticeAnswerResponse;
    }
  | { type: 'summary'; data: PracticeSessionSummary }
  | { type: 'review'; items: QuizReviewItemDto[]; index: number; topicName: string }
  | { type: 'error'; message: string };

export function PracticeSessionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const topicId = searchParams.get('topicId') || '';
  const topicName = searchParams.get('topicName') || 'Luyện tập';
  const quizId = searchParams.get('quizId') || '';
  const mode = searchParams.get('mode') || 'standard';
  const isReviewMode = mode === 'review';
  const isFixedMode = mode === 'fixed';
  const isQuizPracticeMode = mode === 'practice' && !!quizId;
  const isTestMode = mode === 'test' && !!quizId;
  const autoStartMode = isReviewMode || isFixedMode || isQuizPracticeMode || isTestMode;
  const questionIdsParam = searchParams.get('questionIds');
  const reviewQuestionIds = questionIdsParam ? questionIdsParam.split(',').filter(Boolean) : undefined;
  const fixedQuestionIds = isFixedMode ? reviewQuestionIds : undefined;

  const [state, setState] = useState<SessionState>({ type: 'idle' });
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [detailedExplanations, setDetailedExplanations] = useState<Record<string, string>>({});
  const [loadingDetailedFor, setLoadingDetailedFor] = useState<string | null>(null);
  const [detailedErrors, setDetailedErrors] = useState<Record<string, boolean>>({});
  const questionStartRef = useRef<number>(Date.now());
  const autoStartedRef = useRef(false);

  const modeLabel = isTestMode
    ? 'Bài kiểm tra'
    : isQuizPracticeMode
      ? 'Luyện tập quiz lớp'
      : isReviewMode
        ? 'Ôn tập'
        : isFixedMode
          ? 'Quiz Pool'
          : 'Luyện tập';

  const startMutation = useMutation({
    mutationFn: () => {
      if (isTestMode) return practiceSessionService.startQuizTest(quizId);
      if (isQuizPracticeMode) return practiceSessionService.startQuizPractice(quizId);
      if (isReviewMode) return practiceSessionService.startReview(reviewQuestionIds);
      if (isFixedMode) {
        if (!fixedQuestionIds?.length) return Promise.reject(new Error('Missing questionIds'));
        return practiceSessionService.startFixed(fixedQuestionIds, topicId || undefined);
      }
      return practiceSessionService.start(topicId, 10);
    },
    onSuccess: (data) => {
      setTotalQuestions(data.totalQuestions);
      questionStartRef.current = Date.now();
      setState({
        type: 'answering',
        sessionId: data.sessionId,
        question: data.question,
        questionNumber: data.questionNumber,
        total: data.totalQuestions,
        phase: 'selecting',
      });
    },
    onError: () => {
      const message = isTestMode
        ? 'Không thể bắt đầu bài kiểm tra.'
        : isQuizPracticeMode
          ? 'Không thể bắt đầu luyện tập quiz lớp.'
          : isReviewMode
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
      if (state.type !== 'answering') return;

      if (data.feedbackSuppressed || isTestMode) {
        if (data.isSessionComplete || !data.nextQuestion) {
          summaryMutation.mutate(vars.sessionId);
        } else {
          setSelectedOptions([]);
          questionStartRef.current = Date.now();
          setState({
            type: 'answering',
            sessionId: vars.sessionId,
            question: data.nextQuestion,
            questionNumber: data.questionNumber,
            total: data.totalQuestions ?? totalQuestions,
            phase: 'selecting',
          });
        }
        return;
      }

      setState({
        ...state,
        phase: 'reviewing',
        feedback: data,
      });
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
    if (!isReviewMode && !isFixedMode && !isQuizPracticeMode && !isTestMode && !topicId) {
      navigate('/student/classes', { replace: true });
    }
  }, [isReviewMode, isFixedMode, isQuizPracticeMode, isTestMode, topicId, navigate]);

  const handleSubmit = useCallback(() => {
    if (state.type !== 'answering' || state.phase !== 'selecting' || selectedOptions.length === 0) return;
    submitMutation.mutate({
      sessionId: state.sessionId,
      questionId: state.question.questionId,
      selectedOptionIds: selectedOptions,
    });
  }, [state, selectedOptions, submitMutation]);

  const handleNext = useCallback(() => {
    if (state.type !== 'answering' || state.phase !== 'reviewing' || !state.feedback) return;
    const { feedback, sessionId } = state;
    if (feedback.isSessionComplete || !feedback.nextQuestion) {
      summaryMutation.mutate(sessionId);
    } else {
      setSelectedOptions([]);
      questionStartRef.current = Date.now();
      setState({
        type: 'answering',
        sessionId,
        question: feedback.nextQuestion,
        questionNumber: feedback.questionNumber,
        total: feedback.totalQuestions ?? totalQuestions,
        phase: 'selecting',
      });
    }
  }, [state, summaryMutation, totalQuestions]);

  const toggleOption = (optId: string) => {
    if (state.type !== 'answering' || state.phase !== 'selecting') return;
    setSelectedOptions((prev) =>
      prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId],
    );
  };

  const requestDetailedExplanation = useCallback(
    async (questionId: string, questionText: string, options: { id: string; text: string }[], selectedOptionIds: string[], correctAnswerText?: string) => {
      setLoadingDetailedFor(questionId);
      setDetailedErrors((prev) => ({ ...prev, [questionId]: false }));
      try {
        const studentAnswer = options.find((o) => selectedOptionIds.includes(o.id))?.text ?? '';
        const explanation = await quizzesService.getErrorExplanation({
          question: questionText,
          correctAnswer: correctAnswerText ?? '',
          studentAnswer,
        });
        setDetailedExplanations((prev) => ({ ...prev, [questionId]: explanation.explanation }));
        return explanation.explanation;
      } catch {
        setDetailedErrors((prev) => ({ ...prev, [questionId]: true }));
        throw new Error('Failed');
      } finally {
        setLoadingDetailedFor(null);
      }
    },
    [],
  );

  const backTarget = isReviewMode
    ? '/student/review'
    : isFixedMode
      ? '/student/quiz-pool'
      : isTestMode || isQuizPracticeMode
        ? -1
        : -1;

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
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button size="lg" onClick={handleStart}>Bắt đầu luyện tập</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((state.type === 'idle' && autoStartMode) || state.type === 'loading') {
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
        <Button onClick={() => (typeof backTarget === 'string' ? navigate(backTarget) : setState({ type: 'idle' }))}>
          Quay lại
        </Button>
      </div>
    );
  }

  if (state.type === 'answering') {
    const { question, questionNumber, total, phase, feedback } = state;
    const displayTopicName = topicName !== 'Luyện tập' ? topicName : modeLabel;

    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            {displayTopicName} — Câu {questionNumber}/{total}
          </Badge>
          <Badge variant="outline">
            {question.difficulty}
            {typeof question.difficultyIndex === 'number' ? ` (β ${question.difficultyIndex.toFixed(2)})` : ''}
          </Badge>
        </div>
        <Progress value={(questionNumber / total) * 100} className="h-2" />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-lg font-medium">{question.text}</p>
            <div className="space-y-2">
              {question.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={phase === 'reviewing'}
                  onClick={() => toggleOption(opt.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedOptions.includes(opt.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent'
                  } ${phase === 'reviewing' ? 'cursor-default opacity-80' : ''}`}
                >
                  {opt.text}
                </button>
              ))}
            </div>

            {phase === 'selecting' && (
              <Button
                className="w-full"
                disabled={selectedOptions.length === 0 || submitMutation.isPending}
                onClick={handleSubmit}
              >
                {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isTestMode ? 'Nộp câu trả lời' : 'Xác nhận'}
              </Button>
            )}

            {phase === 'reviewing' && feedback && (
              <div className="space-y-3">
                <QuizAnswerFeedback
                  questionText={question.text}
                  options={question.options}
                  selectedOptionIds={selectedOptions}
                  isCorrect={feedback.isCorrect}
                  correctAnswerText={feedback.correctAnswer}
                  explanation={feedback.explanation}
                  spacedRepetition={feedback.spacedRepetition}
                  variant="live"
                  continueLabel={feedback.isSessionComplete ? 'Xem kết quả' : 'Câu tiếp theo'}
                  onContinue={handleNext}
                  detailedExplanation={detailedExplanations[question.questionId]}
                  isLoadingDetailedExplanation={loadingDetailedFor === question.questionId}
                  detailedExplanationError={detailedErrors[question.questionId]}
                  onRequestDetailedExplanation={() =>
                    requestDetailedExplanation(
                      question.questionId,
                      question.text,
                      question.options,
                      selectedOptions,
                      feedback.correctAnswer,
                    )
                  }
                  onRetryDetailedExplanation={() =>
                    requestDetailedExplanation(
                      question.questionId,
                      question.text,
                      question.options,
                      selectedOptions,
                      feedback.correctAnswer,
                    )
                  }
                />
                {(feedback.agentReason || feedback.agentExplanation || feedback.agentAction) && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    {feedback.agentAction && <p className="font-medium">Agent action: {feedback.agentAction}</p>}
                    {feedback.agentReason && <p className="text-muted-foreground">{feedback.agentReason}</p>}
                    {feedback.agentExplanation && <p className="mt-2">{feedback.agentExplanation}</p>}
                    {(typeof feedback.thetaAfter === 'number' || typeof feedback.questionBeta === 'number') && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {typeof feedback.thetaBefore === 'number' ? `θ trước: ${feedback.thetaBefore.toFixed(2)} · ` : ''}
                        {typeof feedback.thetaAfter === 'number' ? `θ sau: ${feedback.thetaAfter.toFixed(2)} · ` : ''}
                        {typeof feedback.questionBeta === 'number' ? `β câu hỏi: ${feedback.questionBeta.toFixed(2)}` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.type === 'summary') {
    const { data } = state;
    const percentage = Math.round(data.score);
    const hasReview = isTestMode && data.reviewItems && data.reviewItems.length > 0;

    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardHeader className="text-center">
            <Trophy className="mx-auto h-12 w-12 text-yellow-500" />
            <CardTitle>
              {isTestMode ? 'Kết quả bài kiểm tra' : isReviewMode ? 'Kết quả ôn tập' : isFixedMode ? 'Kết quả Quiz Pool' : 'Kết quả luyện tập'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">{percentage}%</p>
              <p className="text-muted-foreground">
                {data.correctAnswers}/{data.questionsAttempted} câu đúng
              </p>
            </div>
            <Progress value={percentage} className="h-3" />
            {data.nextReviewSummary && (
              <p className="rounded-lg bg-primary/5 p-3 text-sm text-primary">{data.nextReviewSummary}</p>
            )}
            {data.recommendation && (
              <p className="rounded-lg bg-muted p-3 text-sm">{data.recommendation}</p>
            )}
            <div className="flex flex-col gap-3">
              {hasReview && (
                <Button
                  onClick={() =>
                    setState({
                      type: 'review',
                      items: data.reviewItems!,
                      index: 0,
                      topicName: data.topicName,
                    })
                  }
                >
                  Xem lại bài làm
                </Button>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => (typeof backTarget === 'string' ? navigate(backTarget) : navigate(-1))}
                >
                  Quay lại
                </Button>
                {!isReviewMode && !isFixedMode && !isTestMode && (
                  <Button className="flex-1" onClick={() => setState({ type: 'idle' })}>
                    Luyện tiếp
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.type === 'review') {
    const item = state.items[state.index];
    const selectedIds = item.selectedOptionId ? [item.selectedOptionId] : [];

    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            Xem lại — Câu {state.index + 1}/{state.items.length}
          </Badge>
          <span className="text-sm text-muted-foreground">{state.topicName}</span>
        </div>
        <Progress value={((state.index + 1) / state.items.length) * 100} className="h-2" />

        <Card>
          <CardContent className="pt-6">
            <QuizAnswerFeedback
              questionText={item.text}
              options={item.options.map((o) => ({
                ...o,
                isCorrect: o.id === item.correctOptionId,
              }))}
              selectedOptionIds={selectedIds}
              isCorrect={item.isCorrect}
              correctAnswerText={item.correctAnswer}
              correctOptionId={item.correctOptionId}
              explanation={item.explanation}
              variant="review"
              detailedExplanation={detailedExplanations[item.questionId]}
              isLoadingDetailedExplanation={loadingDetailedFor === item.questionId}
              detailedExplanationError={detailedErrors[item.questionId]}
              onRequestDetailedExplanation={() =>
                requestDetailedExplanation(
                  item.questionId,
                  item.text,
                  item.options,
                  selectedIds,
                  item.correctAnswer,
                )
              }
              onRetryDetailedExplanation={() =>
                requestDetailedExplanation(
                  item.questionId,
                  item.text,
                  item.options,
                  selectedIds,
                  item.correctAnswer,
                )
              }
            />
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            disabled={state.index === 0}
            onClick={() => setState({ ...state, index: state.index - 1 })}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Câu trước
          </Button>
          <Button
            disabled={state.index >= state.items.length - 1}
            onClick={() => setState({ ...state, index: state.index + 1 })}
          >
            Câu sau <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
