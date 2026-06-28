import { useState, useCallback, useEffect, useReducer, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { practiceSessionService } from '@/features/practice/api/practice-session.service';
import { invalidateLearningQueries } from '@/shared/lib/invalidate-learning-queries';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Progress } from '@/shared/ui/progress';
import { QuizAnswerFeedback } from '@/features/quizzes/components/quiz-answer-feedback';
import {
  ArrowLeft,
  Trophy,
  Loader2,
  Brain,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  MessageSquareQuote,
} from 'lucide-react';
import { toast } from 'sonner';
import { normalizeText } from '@/shared/lib/text-normalization';
import { useAiExplanation } from '@/features/practice/hooks/use-ai-explanation';
import type { SubmitPracticeAnswerResponse, PracticeQuestionDto } from '@/features/practice/types';
import {
  initialPracticeSessionState,
  currentTimeMs,
  replacePracticeSessionState,
  resolvePracticeSessionMode,
} from '@/features/practice/model/practice-session-state';

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function PracticeSessionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionMode = resolvePracticeSessionMode(searchParams);
  const {
    topicId,
    classId,
    topicName: topicNameParam,
    quizId,
    isFixed: isFixedMode,
    isQuizPractice: isQuizPracticeMode,
    isTest: isTestMode,
    isSelfPractice: isSelfPracticeMode,
    autoStart: autoStartMode,
    fixedQuestionIds,
    label: modeLabel,
  } = sessionMode;

  const [state, setState] = useReducer(replacePracticeSessionState, initialPracticeSessionState);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [resolvedTopicName, setResolvedTopicName] = useState('');
  const {
    explanations: detailedExplanations,
    loadingFor: loadingDetailedFor,
    errors: detailedErrors,
    offline: detailedOffline,
    request: requestAiExplanation,
  } = useAiExplanation({ notifyOnError: true });
  const questionStartRef = useRef(0);
  const autoStartedRef = useRef(false);

  const startMutation = useMutation({
    mutationFn: () => {
      if (isTestMode) return practiceSessionService.startQuizTest(quizId);
      if (isQuizPracticeMode) return practiceSessionService.startQuizPractice(quizId);
      if (isSelfPracticeMode) return practiceSessionService.startSelfPractice(classId, topicId);
      if (isFixedMode) {
        if (!fixedQuestionIds?.length) return Promise.reject(new Error('Missing questionIds'));
        return practiceSessionService.startFixed(fixedQuestionIds, topicId || undefined);
      }
      return practiceSessionService.start(topicId, 10);
    },
    onSuccess: (data) => {
      setTotalQuestions(data.totalQuestions);
      setResolvedTopicName(data.topicName);
      questionStartRef.current = currentTimeMs();
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
        : isSelfPracticeMode
          ? 'Không thể bắt đầu tự luyện tập.'
        : isQuizPracticeMode
          ? 'Không thể bắt đầu luyện tập quiz lớp.'
          : isFixedMode
              ? 'Không thể bắt đầu phiên luyện tập từ Quiz Pool.'
              : 'Không thể bắt đầu phiên luyện tập.';
      setState({ type: 'error', message });
      toast.error(message);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (vars: { sessionId: string; questionId: string; selectedOptionIds: string[] }) => {
      const responseTimeSeconds = (currentTimeMs() - questionStartRef.current) / 1000;
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
          questionStartRef.current = currentTimeMs();
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
      if (!isSelfPracticeMode) {
        invalidateLearningQueries(queryClient);
      }
      setState({ type: 'summary', data });
    },
    onError: () => toast.error('Không tải được kết quả'),
  });

  const handleStart = () => {
    setState({ type: 'loading' });
    startMutation.mutate();
  };

  useEffect(() => {
    if (autoStartMode && !autoStartedRef.current) {
      autoStartedRef.current = true;
      setState({ type: 'loading' });
      startMutation.mutate();
    }
  }, [autoStartMode, startMutation, setState]);

  useEffect(() => {
    if (!isFixedMode && !isQuizPracticeMode && !isTestMode && !isSelfPracticeMode && !topicId) {
      navigate('/student/classes', { replace: true });
    }
  }, [isFixedMode, isQuizPracticeMode, isTestMode, isSelfPracticeMode, topicId, navigate]);

  const handleSubmit = () => {
    if (state.type !== 'answering' || state.phase !== 'selecting' || selectedOptions.length === 0) return;
    submitMutation.mutate({
      sessionId: state.sessionId,
      questionId: state.question.questionId,
      selectedOptionIds: selectedOptions,
    });
  };

  const handleNext = () => {
    if (state.type !== 'answering' || state.phase !== 'reviewing' || !state.feedback) return;
    const { feedback, sessionId } = state;

    if (feedback.isSessionComplete || !feedback.nextQuestion) {
      summaryMutation.mutate(sessionId);
    } else {
      setSelectedOptions([]);
      questionStartRef.current = currentTimeMs();
      setState({
        type: 'answering',
        sessionId,
        question: feedback.nextQuestion,
        questionNumber: feedback.questionNumber,
        total: feedback.totalQuestions ?? totalQuestions,
        phase: 'selecting',
      });
    }
  };

  const goToSuggestedTopic = (feedback: SubmitPracticeAnswerResponse) => {
    if (!feedback.suggestedNextTopicId) return;
    const params = new URLSearchParams({
      mode: 'self_practice',
      classId,
      topicId: feedback.suggestedNextTopicId,
      topicName: feedback.suggestedNextTopicName ?? 'Tự luyện tập',
    });
    navigate(`/student/practice-session?${params.toString()}`);
  };

  const toggleOption = (optId: string) => {
    if (state.type !== 'answering' || state.phase !== 'selecting') return;
    setSelectedOptions((prev) =>
      prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId],
    );
  };

  const requestDetailedExplanation = useCallback(
    async (
      questionId: string,
      questionText: string,
      options: { id: string; text: string }[],
      correctAnswerText?: string,
      hintQuestionId?: string,
    ) => {
      return requestAiExplanation({
        key: questionId,
        question: questionText,
        options,
        correctAnswer: correctAnswerText,
        questionId: hintQuestionId,
      });
    },
    [requestAiExplanation],
  );

  const fetchPreAnswerHint = useCallback(
    async (question: PracticeQuestionDto) => {
      await requestDetailedExplanation(
        question.questionId,
        question.text,
        question.options,
        undefined,
        question.questionId,
      );
    },
    [requestDetailedExplanation],
  );

  const backTarget = isFixedMode
    ? '/student/quiz-pool'
    : isSelfPracticeMode
        ? `/student/classes/${classId}?tab=practice`
      : isTestMode || isQuizPracticeMode
        ? -1
        : -1;

  const displayTopicName = (() => {
    const topicNameLooksLikeId = GUID_PATTERN.test(topicNameParam);
    const candidate = topicNameParam && topicNameParam !== topicId && !topicNameLooksLikeId
      ? topicNameParam
      : resolvedTopicName;
    if (candidate) return candidate;
    return modeLabel;
  })();

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
              Chủ đề: <strong>{displayTopicName}</strong>
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

    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            {displayTopicName} — Câu {questionNumber}/{total}
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

            {phase === 'selecting' && !isTestMode && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => void fetchPreAnswerHint(question)}
                    disabled={loadingDetailedFor === question.questionId}
                    className="gap-2"
                  >
                    {loadingDetailedFor === question.questionId ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                        Đang tải gợi ý...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-violet-500" />
                        AI gợi ý
                      </>
                    )}
                  </Button>
                </div>

                {(loadingDetailedFor === question.questionId ||
                  detailedExplanations[question.questionId] ||
                  detailedErrors[question.questionId] ||
                  detailedOffline[question.questionId]) && (
                  <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent p-4 animate-in fade-in duration-300">
                    <div className="mb-2 flex items-center gap-2">
                      <MessageSquareQuote className="h-4 w-4 text-violet-500" />
                      <span className="text-sm font-medium text-violet-600 dark:text-violet-400">AI gợi ý</span>
                    </div>
                    {loadingDetailedFor === question.questionId && (
                      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                        <span>Gia sư AI đang chuẩn bị gợi ý...</span>
                      </div>
                    )}
                    {detailedOffline[question.questionId] && loadingDetailedFor !== question.questionId && (
                      <div className="py-2 text-sm text-muted-foreground">
                        Gia sư AI hiện không khả dụng.
                      </div>
                    )}
                    {detailedErrors[question.questionId] &&
                      !detailedOffline[question.questionId] &&
                      loadingDetailedFor !== question.questionId && (
                        <div className="py-2 text-sm text-destructive">
                          <span>Không thể tải AI gợi ý. </span>
                          <button
                            type="button"
                            onClick={() => void fetchPreAnswerHint(question)}
                            className="ml-1 font-medium text-violet-600 underline hover:text-violet-500 dark:text-violet-400"
                          >
                            Thử lại
                          </button>
                        </div>
                      )}
                    {detailedExplanations[question.questionId] && loadingDetailedFor !== question.questionId && (
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-foreground/90 dark:prose-invert">
                        {normalizeText(detailedExplanations[question.questionId])}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

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
                  variant="live"
                  continueLabel={feedback.isSessionComplete ? 'Xem kết quả' : 'Câu tiếp theo'}
                  onContinue={handleNext}
                />
                {isSelfPracticeMode && feedback.recommendNextSkill && feedback.suggestedNextTopicId && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        {feedback.nextSkillSuggestion ?? 'Bạn đã thành thạo chủ đề này và có thể chuyển sang chủ đề khác.'}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-2"
                        onClick={() => goToSuggestedTopic(feedback)}
                      >
                        Chuyển chủ đề
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
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
              {isTestMode ? 'Kết quả bài kiểm tra' : isFixedMode ? 'Kết quả Quiz Pool' : 'Kết quả luyện tập'}
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
                      summary: data,
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
                {!isFixedMode && !isTestMode && (
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
          <Button variant="ghost" size="sm" onClick={() => setState({ type: 'summary', data: state.summary })}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại kết quả
          </Button>
          <Badge variant="secondary">
            Xem lại — Câu {state.index + 1}/{state.items.length}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">{state.topicName}</div>
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
                  item.correctAnswer,
                )
              }
              onRetryDetailedExplanation={() =>
                requestDetailedExplanation(
                  item.questionId,
                  item.text,
                  item.options,
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
