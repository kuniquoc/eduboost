import { useState, useCallback } from 'react';

import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { placementTestService } from '@/services/placementTest.service';

import { quizzesService } from '@/services/quizzes.service';

import { invalidateLearningQueries } from '@/lib/invalidate-learning-queries';

import { ROUTES } from '@/lib/constants';

import { Button } from '@/components/ui/button';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';

import { Progress } from '@/components/ui/progress';

import { QuizAnswerFeedback } from '@/components/quiz/quiz-answer-feedback';

import {

  ArrowRight,

  Trophy,

  Loader2,

  Target,

  TrendingUp,

  TrendingDown,

  ArrowLeft,

  ChevronLeft,

  ChevronRight,

} from 'lucide-react';

import { toast } from 'sonner';

import type {

  PlacementQuestionDto,

  CompletePlacementResponse,

  QuizReviewItemDto,

} from '@/types';



type TestState =

  | { type: 'idle' }

  | { type: 'loading' }

  | { type: 'question'; sessionId: string; question: PlacementQuestionDto; questionNumber: number; total: number }

  | { type: 'complete'; result: CompletePlacementResponse }

  | { type: 'review'; items: QuizReviewItemDto[]; index: number; completeResult: CompletePlacementResponse }

  | { type: 'error'; message: string };



export function PlacementTestPage() {

  const { classId: classIdParam = '' } = useParams<{ classId: string }>();

  const [searchParams] = useSearchParams();

  const classId = classIdParam || searchParams.get('classId') || '';

  const navigate = useNavigate();

  const queryClient = useQueryClient();



  const [state, setState] = useState<TestState>({ type: 'idle' });

  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const [detailedExplanations, setDetailedExplanations] = useState<Record<string, string>>({});

  const [loadingDetailedFor, setLoadingDetailedFor] = useState<string | null>(null);

  const [detailedErrors, setDetailedErrors] = useState<Record<string, boolean>>({});



  const startMutation = useMutation({

    mutationFn: () => placementTestService.start(classId),

    onSuccess: (data) => {

      if (!data.question?.questionId) {

        setState({ type: 'error', message: 'Chưa có câu hỏi cho bài kiểm tra này. Liên hệ giáo viên.' });

        return;

      }

      setState({

        type: 'question',

        sessionId: data.sessionId,

        question: data.question,

        questionNumber: data.questionNumber,

        total: data.totalQuestions,

      });

    },

    onError: () => {

      setState({ type: 'error', message: 'Không thể bắt đầu bài kiểm tra.' });

      toast.error('Không thể bắt đầu bài kiểm tra');

    },

  });



  const answerMutation = useMutation({

    mutationFn: (vars: { sessionId: string; questionId: string; selectedOptionIds: string[] }) =>

      placementTestService.submitAnswer(vars.sessionId, vars.questionId, vars.selectedOptionIds),

    onSuccess: (data, vars) => {

      setSelectedOptions([]);

      if (data.isComplete || !data.nextQuestion) {

        completeMutation.mutate(vars.sessionId);

      } else {

        setState({

          type: 'question',

          sessionId: vars.sessionId,

          question: data.nextQuestion,

          questionNumber: data.questionNumber,

          total: data.totalQuestions,

        });

      }

    },

    onError: () => toast.error('Lỗi khi gửi câu trả lời'),

  });



  const completeMutation = useMutation({

    mutationFn: (sessionId: string) => placementTestService.complete(sessionId),

    onSuccess: (data) => {

      invalidateLearningQueries(queryClient, data.classId || classId || undefined);

      setState({ type: 'complete', result: data });

    },

    onError: () => toast.error('Lỗi khi hoàn thành bài kiểm tra'),

  });



  const handleStart = useCallback(() => {

    setState({ type: 'loading' });

    startMutation.mutate();

  }, [startMutation]);



  const handleSubmit = useCallback(() => {

    if (state.type !== 'question' || selectedOptions.length === 0) return;

    answerMutation.mutate({

      sessionId: state.sessionId,

      questionId: state.question.questionId,

      selectedOptionIds: selectedOptions,

    });

  }, [state, selectedOptions, answerMutation]);



  const requestDetailedExplanation = useCallback(

    async (item: QuizReviewItemDto): Promise<string> => {

      setLoadingDetailedFor(item.questionId);

      setDetailedErrors((prev) => ({ ...prev, [item.questionId]: false }));

      try {

        const explanation = await quizzesService.getErrorExplanation({

          question: item.text,

          options: item.options,

          correctAnswer: item.correctAnswer ?? '',

        });

        setDetailedExplanations((prev) => ({ ...prev, [item.questionId]: explanation.explanation }));

        return explanation.explanation;

      } catch {

        setDetailedErrors((prev) => ({ ...prev, [item.questionId]: true }));

        throw new Error('Failed');

      } finally {

        setLoadingDetailedFor(null);

      }

    },

    [],

  );



  if (state.type === 'idle') {

    return (

      <div className="min-h-screen bg-background p-6">

        <div className="mx-auto max-w-2xl space-y-6">

          <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.STUDENT_DASHBOARD)}>

            <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại

          </Button>

          <Card>

            <CardHeader className="text-center">

              <Target className="mx-auto h-12 w-12 text-primary" />

              <CardTitle className="mt-4">Bài kiểm tra đầu vào</CardTitle>

              <p className="text-muted-foreground">

                Hệ thống điều chỉnh độ khó theo câu trả lời của bạn. Kết quả và giải thích chỉ hiển thị sau khi hoàn thành.

              </p>

            </CardHeader>

            <CardContent className="flex justify-center">

              <Button size="lg" onClick={handleStart} disabled={!classId}>

                Bắt đầu kiểm tra

              </Button>

            </CardContent>

          </Card>

        </div>

      </div>

    );

  }



  if (state.type === 'loading') {

    return (

      <div className="flex min-h-screen items-center justify-center bg-background">

        <Loader2 className="h-8 w-8 animate-spin text-primary" />

      </div>

    );

  }



  if (state.type === 'error') {

    return (

      <div className="mx-auto max-w-2xl space-y-4 p-6 text-center">

        <p className="text-destructive">{state.message}</p>

        <Button onClick={() => setState({ type: 'idle' })}>Thử lại</Button>

      </div>

    );

  }



  if (state.type === 'question') {

    const { question, questionNumber, total } = state;

    return (

      <div className="min-h-screen bg-background p-6">

        <div className="mx-auto max-w-2xl space-y-6">

          <div className="flex items-center justify-between">

            <Badge variant="secondary">Bài kiểm tra — Câu {questionNumber}/{total}</Badge>

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

                    type="button"

                    onClick={() => setSelectedOptions([opt.id])}

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

                disabled={selectedOptions.length === 0 || answerMutation.isPending}

                onClick={handleSubmit}

              >

                {answerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}

                Nộp câu trả lời

                <ArrowRight className="ml-2 h-4 w-4" />

              </Button>

            </CardContent>

          </Card>

        </div>

      </div>

    );

  }



  if (state.type === 'complete') {

    const { result } = state;

    const hasReview = result.reviewItems && result.reviewItems.length > 0;



    return (

      <div className="min-h-screen bg-background p-6">

        <div className="mx-auto max-w-2xl space-y-6">

          <Card>

            <CardHeader className="text-center">

              <Trophy className="mx-auto h-12 w-12 text-yellow-500" />

              <CardTitle>Kết quả đánh giá</CardTitle>

            </CardHeader>

            <CardContent className="space-y-6">

              <div className="text-center">

                <Badge className="px-4 py-2 text-lg">{result.initialLevel}</Badge>

                <p className="mt-2 text-muted-foreground">Điểm: {Math.round(result.finalScore)}%</p>

              </div>

              {result.strengths.length > 0 && (

                <div>

                  <h3 className="mb-2 flex items-center gap-2 font-medium text-green-600">

                    <TrendingUp className="h-4 w-4" /> Điểm mạnh

                  </h3>

                  {result.strengths.map((s) => (

                    <div key={s.topicId} className="flex justify-between rounded bg-green-50 px-3 py-2 dark:bg-green-950/20">

                      <span className="text-sm">{s.topicName}</span>

                      <span className="text-sm font-medium text-green-600">{Math.round(s.score * 100)}%</span>

                    </div>

                  ))}

                </div>

              )}

              {result.weaknesses.length > 0 && (

                <div>

                  <h3 className="mb-2 flex items-center gap-2 font-medium text-orange-600">

                    <TrendingDown className="h-4 w-4" /> Cần cải thiện

                  </h3>

                  {result.weaknesses.map((w) => (

                    <div key={w.topicId} className="flex justify-between rounded bg-orange-50 px-3 py-2 dark:bg-orange-950/20">

                      <span className="text-sm">{w.topicName}</span>

                      <span className="text-sm font-medium text-orange-600">{Math.round(w.score * 100)}%</span>

                    </div>

                  ))}

                </div>

              )}

              <div className="flex flex-col gap-3">

                {hasReview && (

                  <Button

                    variant="outline"

                    onClick={() =>

                      setState({ type: 'review', items: result.reviewItems!, index: 0, completeResult: result })

                    }

                  >

                    Xem lại bài làm

                  </Button>

                )}

                <Button

                  className="w-full"

                  onClick={() => navigate(ROUTES.STUDENT_ROADMAP.replace(':classId', classId))}

                >

                  Xem lộ trình học

                </Button>

              </div>

            </CardContent>

          </Card>

        </div>

      </div>

    );

  }



  if (state.type === 'review') {

    const item = state.items[state.index];

    const selectedIds = item.selectedOptionId ? [item.selectedOptionId] : [];



    return (

      <div className="min-h-screen bg-background p-6">

        <div className="mx-auto max-w-2xl space-y-6">

          <div className="flex items-center justify-between">

            <Button variant="ghost" size="sm" onClick={() => setState({ type: 'complete', result: state.completeResult })}>

              <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại kết quả

            </Button>

            <Badge variant="secondary">

              Xem lại — Câu {state.index + 1}/{state.items.length}

            </Badge>

          </div>

          <Progress value={((state.index + 1) / state.items.length) * 100} className="h-2" />



          <Card>

            <CardContent className="pt-6">

              <QuizAnswerFeedback

                questionText={item.text}

                options={item.options.map((o) => ({ ...o, isCorrect: o.id === item.correctOptionId }))}

                selectedOptionIds={selectedIds}

                isCorrect={item.isCorrect}

                correctAnswerText={item.correctAnswer}

                correctOptionId={item.correctOptionId}

                explanation={item.explanation}

                variant="review"

                detailedExplanation={detailedExplanations[item.questionId]}

                isLoadingDetailedExplanation={loadingDetailedFor === item.questionId}

                detailedExplanationError={detailedErrors[item.questionId]}

                onRequestDetailedExplanation={() => requestDetailedExplanation(item)}

                onRetryDetailedExplanation={() => requestDetailedExplanation(item)}

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

      </div>

    );

  }



  return null;

}



/** @deprecated Use PlacementTestPage — kept for route alias */

export const EntryTestPage = PlacementTestPage;

