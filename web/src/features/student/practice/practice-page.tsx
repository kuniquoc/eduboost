import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { quizzesService } from '@/services/quizzes.service';
import { normalizeText } from '@/utils/text-normalization';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Lightbulb,
  BookOpen,
  Brain,
  Trophy,
  Loader2,
  ArrowRight,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import type { TutorNextActionDto, TutorQuestionDto, TutorAnswerResult } from '@/types';

// ── Step states for the AI Tutor flow ──────────────────────
type TutorStep =
  | { type: 'loading' }
  | { type: 'explain'; content: string }
  | { type: 'quiz'; question: TutorQuestionDto }
  | { type: 'result'; question: TutorQuestionDto; selectedKey: string; result: TutorAnswerResult }
  | { type: 'mastered' }
  | { type: 'error'; message: string };

export function PracticePage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<TutorStep>({ type: 'loading' });
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showQuizExplanation, setShowQuizExplanation] = useState(false);
  const [showAiExplanation, setShowAiExplanation] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [started, setStarted] = useState(false);

  // ── Mutations ───────────────────────────────────────────
  const nextActionMutation = useMutation({
    mutationFn: () => quizzesService.getTutorNextAction(topicId!),
    onSuccess: (data: TutorNextActionDto) => {
      if (data.action === 'EXPLAIN' || data.action === 'QUIZ') {
        // Skip explanation and go directly to question
        generateQuestionMutation.mutate();
      } else if (data.action === 'NEXT_SKILL') {
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
    onSuccess: (content: string) => {
      setStep({ type: 'explain', content });
    },
    onError: () => {
      setStep({ type: 'explain', content: 'Let\'s review this topic together! When you feel ready, start practicing with quiz questions.' });
    },
  });

  const generateQuestionMutation = useMutation({
    mutationFn: () => quizzesService.generateAdaptiveQuestion(topicId!),
    onSuccess: (question: TutorQuestionDto) => {
      setSelectedOption(null);
      setShowQuizExplanation(false);
      setShowAiExplanation(false);
      errorExplainMutation.reset();
      setStep({ type: 'quiz', question });
    },
    onError: () => {
      setStep({ type: 'error', message: 'Không thể tạo câu hỏi. Vui lòng thử lại.' });
    },
  });

  const submitAnswerMutation = useMutation({
    mutationFn: (vars: { question: TutorQuestionDto; selectedKey: string }) =>
      quizzesService.submitTutorAnswer({
        topicId: topicId!,
        questionText: vars.question.question,
        correctAnswer: vars.question.correctAnswer,
        selectedAnswer: vars.selectedKey,
        difficulty: vars.question.difficultyLevel,
      }),
    onSuccess: (result: TutorAnswerResult, vars) => {
      setQuestionsAnswered((c) => c + 1);
      if (result.isCorrect) setCorrectCount((c) => c + 1);
      setStep({ type: 'result', question: vars.question, selectedKey: vars.selectedKey, result });

      // Pre-fetch explanation immediately on incorrect answer
      if (!result.isCorrect) {
        errorExplainMutation.mutate({
          question: vars.question.question,
          correctAnswer: vars.question.options[vars.question.correctAnswer] || vars.question.correctAnswer,
          studentAnswer: vars.question.options[vars.selectedKey] || vars.selectedKey,
        });
      }
    },
    onError: () => toast.error('Nộp bài thất bại'),
  });

  const errorExplainMutation = useMutation({
    mutationFn: (vars: { question: string; correctAnswer: string; studentAnswer: string }) =>
      quizzesService.getErrorExplanation(vars),
    onSuccess: () => {
      // Keep step as 'result' and read directly from errorExplainMutation.data
    },
    onError: () => toast.error('Không thể tải giải thích từ Gia sư AI'),
  });

  // ── Handlers ────────────────────────────────────────────
  const startSession = useCallback(() => {
    setStarted(true);
    setStep({ type: 'loading' });
    nextActionMutation.mutate();
  }, [nextActionMutation]);

  const handleSubmitAnswer = useCallback(() => {
    if (!selectedOption || step.type !== 'quiz') return;
    submitAnswerMutation.mutate({ question: step.question, selectedKey: selectedOption });
  }, [selectedOption, step, submitAnswerMutation]);

  const handleContinue = useCallback(() => {
    setStep({ type: 'loading' });
    setShowAiExplanation(false);
    errorExplainMutation.reset();
    nextActionMutation.mutate();
  }, [nextActionMutation, errorExplainMutation]);

  const handleExplainError = useCallback(() => {
    if (step.type !== 'result') return;
    errorExplainMutation.mutate({
      question: step.question.question,
      correctAnswer: step.question.options[step.question.correctAnswer] || step.question.correctAnswer,
      studentAnswer: step.question.options[step.selectedKey] || step.selectedKey,
    });
  }, [step, errorExplainMutation]);

  const handleStartQuiz = useCallback(() => {
    setStep({ type: 'loading' });
    generateQuestionMutation.mutate();
  }, [generateQuestionMutation]);

  const isLoading =
    nextActionMutation.isPending ||
    explainMutation.isPending ||
    generateQuestionMutation.isPending ||
    submitAnswerMutation.isPending;

  const accuracy = questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : 0;

  // ── Not started yet ─────────────────────────────────────
  if (!started) {
    return (
      <div>
        <button
          onClick={() => navigate(-1)}
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
          <h1 className="text-3xl font-bold text-foreground">AI Adaptive Tutor</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed max-w-md mx-auto">
            AI sẽ tự động đánh giá trình độ của bạn và điều chỉnh độ khó phù hợp.
            Hãy bắt đầu để trải nghiệm luyện tập thông minh!
          </p>

          <div className="mt-8 grid grid-cols-3 gap-4 max-w-sm mx-auto">
            <div className="rounded-xl border border-border p-3 text-center">
              <BookOpen className="mx-auto mb-1 h-5 w-5 text-blue-400" />
              <p className="text-xs text-muted-foreground">Học lý thuyết</p>
            </div>
            <div className="rounded-xl border border-border p-3 text-center">
              <Sparkles className="mx-auto mb-1 h-5 w-5 text-amber-400" />
              <p className="text-xs text-muted-foreground">Luyện tập AI</p>
            </div>
            <div className="rounded-xl border border-border p-3 text-center">
              <Trophy className="mx-auto mb-1 h-5 w-5 text-green-400" />
              <p className="text-xs text-muted-foreground">Thành thạo</p>
            </div>
          </div>

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
        onClick={() => navigate(-1)}
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
              <h2 className="text-lg font-semibold text-foreground">Bài giảng từ AI Tutor</h2>
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

      {/* ── QUIZ ────────────────────────────────────────── */}
      {step.type === 'quiz' && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Sparkles className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Câu hỏi luyện tập</h2>
                <p className="text-xs text-muted-foreground">Câu #{questionsAnswered + 1}</p>
              </div>
            </div>
            <Badge variant="outline">
              Difficulty: {step.question.difficultyLevel > 0 ? '+' : ''}{step.question.difficultyLevel.toFixed(1)}
            </Badge>
          </div>

          <Card className="border-border">
            <CardContent className="p-6">
              <h3 className="mb-6 text-base font-medium text-foreground leading-relaxed">
                {normalizeText(step.question.question)}
              </h3>

              <div className="space-y-3">
                {Object.entries(step.question.options).map(([key, value]) => {
                  const isSelected = selectedOption === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedOption(key)}
                      className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground shadow-sm shadow-primary/10'
                          : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium transition-all ${
                            isSelected
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
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleSubmitAnswer}
              disabled={!selectedOption || submitAnswerMutation.isPending}
              size="lg"
              className="gap-2 px-8"
            >
              {submitAnswerMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Đang chấm...</>
              ) : (
                <>Nộp bài</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── RESULT ──────────────────────────────────────── */}
      {step.type === 'result' && (
        <div className="mx-auto max-w-2xl space-y-6">
          <Card
            className={`border-2 ${
              step.result.isCorrect
                ? 'border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent'
                : 'border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent'
            }`}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                {step.result.isCorrect ? (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                      <CheckCircle className="h-7 w-7 text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-green-400">Chính xác! 🎉</h3>
                      <p className="text-xs text-muted-foreground">Tuyệt vời, bạn đã trả lời đúng</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                      <XCircle className="h-7 w-7 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-red-400">Chưa đúng</h3>
                      <p className="text-xs text-muted-foreground">Đừng lo lắng, hãy xem giải thích hoặc yêu cầu hỗ trợ</p>
                    </div>
                  </>
                )}
              </div>

              {/* Question review */}
              <div className="rounded-xl border border-border bg-background/50 p-4 mb-4">
                <p className="text-sm font-medium text-foreground mb-3">{normalizeText(step.question.question)}</p>
                <div className="space-y-2">
                  {Object.entries(step.question.options).map(([key, value]) => {
                    const isCorrect = key === step.question.correctAnswer;
                    const isStudentPick = key === step.selectedKey;
                    const shouldShowCorrect = step.result.isCorrect || showQuizExplanation;
                    let cls = 'border-border text-muted-foreground';
                    if (isCorrect && shouldShowCorrect) cls = 'border-green-500/40 bg-green-500/10 text-green-400';
                    else if (isStudentPick && !step.result.isCorrect)
                      cls = 'border-red-500/40 bg-red-500/10 text-red-400 line-through';
                    return (
                      <div key={key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
                        <span className="font-medium">{key}.</span>
                        <span>{normalizeText(value)}</span>
                        {isCorrect && shouldShowCorrect && <CheckCircle className="ml-auto h-4 w-4 text-green-400" />}
                        {isStudentPick && !step.result.isCorrect && <XCircle className="ml-auto h-4 w-4 text-red-400" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Inline explanation from quiz generation */}
              {showQuizExplanation && step.question.explanation && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-4 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">Giải thích</span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{normalizeText(step.question.explanation)}</p>
                </div>
              )}

              {/* AI Tutor Explanation */}
              {showAiExplanation && (
                <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent p-4 mb-4 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-violet-400 animate-pulse" />
                    <span className="text-sm font-medium text-violet-400">Gia sư AI hỗ trợ</span>
                  </div>
                  {errorExplainMutation.isPending && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                      <span>Gia sư AI đang phân tích lỗi sai và chuẩn bị lời giải thích...</span>
                    </div>
                  )}
                  {errorExplainMutation.isError && (
                    <div className="text-sm text-red-400 py-2">
                      <span>Không thể tải giải thích từ Gia sư AI. </span>
                      <button 
                        onClick={handleExplainError} 
                        className="underline font-medium text-violet-400 hover:text-violet-300 ml-1"
                      >
                        Thử lại
                      </button>
                    </div>
                  )}
                  {errorExplainMutation.isSuccess && errorExplainMutation.data && (
                    <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-foreground/90 leading-relaxed mt-2">
                      {normalizeText(errorExplainMutation.data)}
                    </div>
                  )}
                </div>
              )}

              {/* Mastery info */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  Mastery: <Badge variant="outline" className="ml-1">{step.result.mastery ?? '—'}</Badge>
                </span>
                <span>P(L): {step.result.newProbability != null ? (step.result.newProbability * 100).toFixed(0) : '—'}%</span>
                <span>θ: {step.result.newTheta != null ? step.result.newTheta.toFixed(2) : '—'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {step.question.explanation && !showQuizExplanation && (
              <Button
                variant="outline"
                onClick={() => setShowQuizExplanation(true)}
                className="gap-2"
              >
                <BookOpen className="h-4 w-4 text-primary" />
                Xem giải thích
              </Button>
            )}
            {!step.result.isCorrect && (
              <Button
                variant={showAiExplanation ? "secondary" : "outline"}
                onClick={() => {
                  setShowAiExplanation(!showAiExplanation);
                  if (!showAiExplanation && !errorExplainMutation.isSuccess && !errorExplainMutation.isPending) {
                    handleExplainError();
                  }
                }}
                className="gap-2 border-primary/30 hover:border-primary/60 bg-primary/5"
              >
                {showAiExplanation ? (
                  <>Ẩn hỗ trợ từ Gia sư AI</>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-violet-400" />
                    {errorExplainMutation.isPending ? 'Đang chuẩn bị hỗ trợ từ AI...' : 'Yêu cầu gia sư AI hỗ trợ'}
                  </>
                )}
              </Button>
            )}
            <div className="ml-auto">
              <Button onClick={handleContinue} disabled={isLoading} className="gap-2">
                Tiếp tục <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
            Chúc mừng! Bạn đã nắm vững kiến thức của chủ đề này (P ≥ 80%).
            Hãy chuyển sang chủ đề tiếp theo trong lộ trình học tập.
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

          <div className="mt-8 flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate(-1)}>
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
            <Button variant="outline" onClick={() => navigate(-1)}>
              Quay lại
            </Button>
            <Button onClick={startSession}>Thử lại</Button>
          </div>
        </div>
      )}
    </div>
  );
}
