import { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { quizzesService } from '@/services/quizzes.service';
import { invalidateLearningQueries } from '@/lib/invalidate-learning-queries';
import { normalizeText } from '@/utils/text-normalization';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Trophy,
  Loader2,
  Sparkles,
  GraduationCap,
  CheckCircle,
  XCircle,
  MessageSquareQuote,
} from 'lucide-react';
import { toast } from 'sonner';
import { QuizAnswerFeedback } from '@/components/quiz/quiz-answer-feedback';
import type { TutorNextActionDto, TutorQuestionDto, TutorAnswerResult } from '@/types';

// ── Step states for the AI Tutor flow ──────────────────────
type TutorStep =
  | { type: 'loading' }
  | { type: 'explain'; content: string }
  | {
    type: 'quiz';
    question: TutorQuestionDto;
    phase: 'selecting' | 'reviewing';
    selectedKey?: string;
    result?: TutorAnswerResult;
  }
  | { type: 'mastered' }
  | { type: 'error'; message: string };

function toTutorHintOptions(question: TutorQuestionDto) {
  return Object.entries(question.options).map(([id, text]) => ({ id, text }));
}

function getTutorCorrectAnswerForHint(question: TutorQuestionDto) {
  const correctText = question.options[question.correctAnswer];
  return correctText ? `${question.correctAnswer}. ${correctText}` : question.correctAnswer;
}

export function PracticePage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<TutorStep>({ type: 'loading' });
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [detailedExplanation, setDetailedExplanation] = useState<string | null>(null);
  const [loadingDetailed, setLoadingDetailed] = useState(false);
  const [detailedError, setDetailedError] = useState(false);
  const [detailedOffline, setDetailedOffline] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [started, setStarted] = useState(false);
  const questionStartRef = useRef<number>(Date.now());
  const questionsAnsweredRef = useRef(0);
  const correctCountRef = useRef(0);
  const sessionRecordedRef = useRef(false);
  const skipNextSkillCheckRef = useRef(false);

  const finalizeTutorSession = useCallback(async () => {
    if (sessionRecordedRef.current || questionsAnsweredRef.current === 0 || !topicId) return;
    sessionRecordedRef.current = true;
    try {
      await quizzesService.completeTutorPractice(
        topicId,
        questionsAnsweredRef.current,
        correctCountRef.current,
      );
      invalidateLearningQueries(queryClient);
    } catch {
      sessionRecordedRef.current = false;
    }
  }, [topicId, queryClient]);

  const handleExit = useCallback(async () => {
    skipNextSkillCheckRef.current = false;
    await finalizeTutorSession();
    navigate(-1);
  }, [finalizeTutorSession, navigate]);

  // ── Mutations ───────────────────────────────────────────
  const nextActionMutation = useMutation({
    mutationFn: () => quizzesService.getTutorNextAction(topicId!),
    onSuccess: (data: TutorNextActionDto) => {
      if (data.action === 'EXPLAIN') {
        explainMutation.mutate();
      } else if (data.action === 'QUIZ') {
        generateQuestionMutation.mutate();
      } else if (data.action === 'NEXT_SKILL') {
        if (skipNextSkillCheckRef.current) {
          generateQuestionMutation.mutate();
          return;
        }
        void finalizeTutorSession();
        invalidateLearningQueries(queryClient);
        setStep({ type: 'mastered' });
      }
    },
    onError: () => {
      // Fallback: try generating a question directly
      generateQuestionMutation.mutate();
    },
  });

  const explainMutation = useMutation({
    mutationFn: () => quizzesService.getTutorExplanation(topicId!),
    onSuccess: ({ content, offline }) => {
      setStep({
        type: 'explain',
        content: offline
          ? 'Gia sư AI hiện đang ngoại tuyến, bạn có thể tiếp tục luyện tập với các câu hỏi quiz mà không cần giải thích chi tiết nếu cần.'
          : content,
      });
    },
    onError: () => {
      setStep({ type: 'explain', content: 'Hãy cùng ôn lại chủ đề này! Khi bạn sẵn sàng, hãy bắt đầu luyện tập với các câu hỏi quiz.' });
    },
  });

  const generateQuestionMutation = useMutation({
    mutationFn: () => quizzesService.generateAdaptiveQuestion(topicId!),
    onSuccess: (question: TutorQuestionDto) => {
      setSelectedOption(null);
      setDetailedExplanation(null);
      setDetailedError(false);
      questionStartRef.current = Date.now();
      setDetailedExplanation(null);
      setDetailedError(false);
      setStep({ type: 'quiz', question, phase: 'selecting' });
    },
    onError: () => {
      setStep({ type: 'error', message: 'Không thể tạo câu hỏi. Vui lòng thử lại.' });
    },
  });

  const submitAnswerMutation = useMutation({
    mutationFn: (vars: { question: TutorQuestionDto; selectedKey: string }) =>
      quizzesService.submitTutorAnswer({
        topicId: topicId!,
        questionId: vars.question.questionId,
        questionText: vars.question.question,
        selectedAnswer: vars.selectedKey,
        difficulty: vars.question.difficultyLevel,
        responseTimeSeconds: (Date.now() - questionStartRef.current) / 1000,
      }),
    onSuccess: (result: TutorAnswerResult, vars) => {
      setQuestionsAnswered((c) => c + 1);
      questionsAnsweredRef.current += 1;
      if (result.isCorrect) {
        setCorrectCount((c) => c + 1);
        correctCountRef.current += 1;
      }
      invalidateLearningQueries(queryClient);
      setStep({
        type: 'quiz',
        question: vars.question,
        phase: 'reviewing',
        selectedKey: vars.selectedKey,
        result,
      });
    },
    onError: () => toast.error('Nộp bài thất bại'),
  });

  // ── Handlers ────────────────────────────────────────────
  const startSession = useCallback(() => {
    setStarted(true);
    setStep({ type: 'loading' });
    generateQuestionMutation.mutate();
  }, [generateQuestionMutation]);

  const handleSubmitAnswer = useCallback(() => {
    if (!selectedOption || step.type !== 'quiz' || step.phase !== 'selecting') return;
    submitAnswerMutation.mutate({ question: step.question, selectedKey: selectedOption });
  }, [selectedOption, step, submitAnswerMutation]);

  const handleContinue = useCallback(() => {
    setStep({ type: 'loading' });
    setDetailedExplanation(null);
    setDetailedError(false);
    setDetailedOffline(false);
    nextActionMutation.mutate();
  }, [nextActionMutation]);

  const handleContinuePractice = useCallback(() => {
    skipNextSkillCheckRef.current = true;
    sessionRecordedRef.current = false;
    setQuestionsAnswered(0);
    setCorrectCount(0);
    questionsAnsweredRef.current = 0;
    correctCountRef.current = 0;
    setDetailedExplanation(null);
    setDetailedError(false);
    setDetailedOffline(false);
    setStep({ type: 'loading' });
    generateQuestionMutation.mutate();
  }, [generateQuestionMutation]);

  const fetchDetailedExplanation = useCallback(async (question: TutorQuestionDto) => {
    setLoadingDetailed(true);
    setDetailedError(false);
    setDetailedOffline(false);
    try {
      const { explanation, offline } = await quizzesService.getErrorExplanation({
        question: question.question,
        options: toTutorHintOptions(question),
        correctAnswer: getTutorCorrectAnswerForHint(question),
      });
      if (offline) {
        setDetailedOffline(true);
        return;
      }
      setDetailedExplanation(explanation);
      return explanation;
    } catch {
      setDetailedError(true);
      toast.error('Không thể tải AI gợi ý');
      throw new Error('Failed');
    } finally {
      setLoadingDetailed(false);
    }
  }, []);

  const fetchPreAnswerHint = useCallback(async (question: TutorQuestionDto) => {
    setLoadingDetailed(true);
    setDetailedError(false);
    setDetailedOffline(false);
    try {
      const { explanation, offline } = await quizzesService.getErrorExplanation({
        question: question.question,
        options: toTutorHintOptions(question),
        correctAnswer: getTutorCorrectAnswerForHint(question),
      });
      if (offline) {
        setDetailedOffline(true);
        return;
      }
      setDetailedExplanation(explanation);
      return explanation;
    } catch {
      setDetailedError(true);
      toast.error('Không thể tải AI gợi ý');
      throw new Error('Failed');
    } finally {
      setLoadingDetailed(false);
    }
  }, []);

  const handleStartQuiz = useCallback(() => {
    setStep({ type: 'loading' });
    generateQuestionMutation.mutate();
  }, [generateQuestionMutation]);

  const accuracy = questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : 0;

  // ── Not started yet ─────────────────────────────────────
  if (!started) {
    return (
      <div>
        <button
          onClick={() => void handleExit()}
          className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại lộ trình
        </button>

        <div className="mx-auto max-w-lg text-center py-12">
          <div className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 blur-xl" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600 shadow-lg shadow-primary/25">
              <Brain className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Gia sư AI</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed max-w-md mx-auto">
            AI sẽ tự động đánh giá trình độ của bạn và điều chỉnh độ khó phù hợp.
            Hãy bắt đầu để trải nghiệm luyện tập thông minh!
          </p>

          <Button onClick={startSession} size="lg" className="mt-8 gap-2 px-8 shadow-lg shadow-primary/20">
            <GraduationCap className="h-5 w-5" /> Bắt đầu luyện tập
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => void handleExit()}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại lộ trình
      </button>

      {/* Stats bar */}
      {questionsAnswered > 0 && (
        <div className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-card/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="h-3 w-3 text-green-400" /> {correctCount}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <XCircle className="h-3 w-3 text-red-400" /> {questionsAnswered - correctCount}
            </Badge>
          </div>
          <div className="flex-1">
            <Progress value={accuracy} className="h-1.5" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">{accuracy}%</span>
        </div>
      )}

      {/* ── LOADING ─────────────────────────────────────── */}
      {step.type === 'loading' && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-600">
              <Brain className="h-8 w-8 text-white animate-pulse" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">AI đang phân tích trình độ của bạn...</p>
        </div>
      )}

      {/* ── EXPLAIN ─────────────────────────────────────── */}
      {step.type === 'explain' && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <BookOpen className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Bài giảng từ Gia sư AI</h2>
              <p className="text-xs text-muted-foreground">
                Hãy đọc kỹ nội dung bên dưới trước khi luyện tập
              </p>
            </div>
          </div>

          <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <CardContent className="p-6">
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-foreground/90 leading-relaxed">
                {normalizeText(step.content)}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button onClick={handleStartQuiz} size="lg" className="gap-2 px-8">
              <Sparkles className="h-4 w-4" /> Tôi đã hiểu, bắt đầu luyện tập
            </Button>
          </div>
        </div>
      )}

      {/* ── QUIZ (inline feedback) ──────────────────────── */}
      {step.type === 'quiz' && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Sparkles className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Câu hỏi luyện tập</h2>
                <p className="text-xs text-muted-foreground">Câu #{questionsAnswered + (step.phase === 'selecting' ? 1 : 0)}</p>
              </div>
            </div>
            <Badge variant="outline">
              Độ khó: {step.question.difficultyLevel > 0 ? '+' : ''}{step.question.difficultyLevel.toFixed(1)}
            </Badge>
          </div>

          <Card className="border-border">
            <CardContent className="space-y-4 p-6">
              <h3 className="text-base font-medium leading-relaxed text-foreground">
                {normalizeText(step.question.question)}
              </h3>

              <div className="space-y-3">
                {Object.entries(step.question.options).map(([key, value]) => {
                  const isSelected =
                    step.phase === 'reviewing'
                      ? key === step.selectedKey
                      : selectedOption === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={step.phase === 'reviewing'}
                      onClick={() => setSelectedOption(key)}
                      className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${isSelected
                        ? 'border-primary bg-primary/10 text-foreground shadow-sm shadow-primary/10'
                        : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                        } ${step.phase === 'reviewing' ? 'cursor-default opacity-80' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium ${isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border text-muted-foreground'
                            }`}
                        >
                          {key}
                        </span>
                        <span className="text-sm">{normalizeText(value)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {step.phase === 'selecting' && (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => void fetchPreAnswerHint(step.question)}
                      disabled={loadingDetailed}
                      className="gap-2"
                    >
                      {loadingDetailed ? (
                        <><Loader2 className="h-4 w-4 animate-spin text-violet-500" /> Đang tải gợi ý...</>
                      ) : (
                        <><Sparkles className="h-4 w-4 text-violet-500" /> AI gợi ý</>
                      )}
                    </Button>
                  </div>

                  {(loadingDetailed || detailedExplanation || detailedError || detailedOffline) && (
                    <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent p-4 animate-in fade-in duration-300">
                      <div className="mb-2 flex items-center gap-2">
                        <MessageSquareQuote className="h-4 w-4 text-violet-500" />
                        <span className="text-sm font-medium text-violet-600 dark:text-violet-400">AI gợi ý</span>
                      </div>
                      {loadingDetailed && (
                        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                          <span>Gia sư AI đang chuẩn bị gợi ý...</span>
                        </div>
                      )}
                      {detailedOffline && !loadingDetailed && (
                        <div className="py-2 text-sm text-muted-foreground">
                          Gia sư AI hiện không khả dụng.
                        </div>
                      )}
                      {detailedError && !detailedOffline && !loadingDetailed && (
                        <div className="py-2 text-sm text-destructive">
                          <span>Không thể tải AI gợi ý. </span>
                          <button
                            type="button"
                            onClick={() => void fetchPreAnswerHint(step.question)}
                            className="ml-1 font-medium text-violet-600 underline hover:text-violet-500 dark:text-violet-400"
                          >
                            Thử lại
                          </button>
                        </div>
                      )}
                      {detailedExplanation && !loadingDetailed && (
                        <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-foreground/90 dark:prose-invert">
                          {normalizeText(detailedExplanation)}
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={handleSubmitAnswer}
                    disabled={!selectedOption || submitAnswerMutation.isPending}
                    size="lg"
                  >
                    {submitAnswerMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang chấm...</>
                    ) : (
                      'Nộp bài'
                    )}
                  </Button>
                </>
              )}

              {step.phase === 'reviewing' && step.result && step.selectedKey && (
                <QuizAnswerFeedback
                  questionText={step.question.question}
                  options={Object.entries(step.question.options).map(([id, text]) => ({
                    id,
                    text,
                    isCorrect: id === step.question.correctAnswer,
                  }))}
                  selectedOptionIds={[step.selectedKey]}
                  isCorrect={step.result.isCorrect}
                  correctAnswerText={
                    step.question.options[step.question.correctAnswer] || step.question.correctAnswer
                  }
                  correctOptionId={step.question.correctAnswer}
                  explanation={step.question.explanation}
                  masteryLabel={step.result.mastery}
                  variant="live"
                  continueLabel="Tiếp tục"
                  onContinue={handleContinue}
                  detailedExplanation={detailedExplanation ?? undefined}
                  isLoadingDetailedExplanation={loadingDetailed}
                  detailedExplanationError={detailedError}
                  detailedExplanationUnavailable={detailedOffline}
                  onRequestDetailedExplanation={() =>
                    fetchDetailedExplanation(step.question)
                  }
                  onRetryDetailedExplanation={() =>
                    fetchDetailedExplanation(step.question)
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── MASTERED ────────────────────────────────────── */}
      {step.type === 'mastered' && (
        <div className="mx-auto max-w-lg text-center py-12">
          <div className="relative mx-auto mb-8 flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-400/30 to-emerald-500/20 blur-2xl animate-pulse" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-green-400/10 to-emerald-500/10 backdrop-blur-sm border border-green-400/20" />
            <Trophy className="relative h-14 w-14 text-green-400 drop-shadow-lg" />
          </div>

          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            Chủ đề đã thành thạo!
          </h1>
          <p className="mt-3 text-muted-foreground max-w-sm mx-auto">
            Chúc mừng! Bạn đã nắm vững kiến thức của chủ đề này.
            Bạn có thể tiếp tục luyện tập để củng cố hoặc quay lại lộ trình để chuyển sang chủ đề khác.
          </p>

          {questionsAnswered > 0 && (
            <div className="mt-6 mx-auto max-w-xs rounded-xl border border-green-500/20 bg-green-500/5 p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">{questionsAnswered}</p>
                  <p className="text-xs text-muted-foreground">Câu hỏi</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{correctCount}</p>
                  <p className="text-xs text-muted-foreground">Đúng</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{accuracy}%</p>
                  <p className="text-xs text-muted-foreground">Chính xác</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={handleContinuePractice} className="gap-2">
              <Sparkles className="h-4 w-4" /> Tiếp tục luyện tập
            </Button>
            <Button variant="outline" onClick={() => void handleExit()} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Quay lại lộ trình
            </Button>
          </div>
        </div>
      )}

      {/* ── ERROR ───────────────────────────────────────── */}
      {step.type === 'error' && (
        <div className="mx-auto max-w-lg text-center py-12">
          <XCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h2 className="text-xl font-bold text-foreground">Đã xảy ra lỗi</h2>
          <p className="mt-2 text-muted-foreground">{step.message}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => void handleExit()}>
              Quay lại
            </Button>
            <Button onClick={startSession}>Thử lại</Button>
          </div>
        </div>
      )}
    </div>
  );
}
