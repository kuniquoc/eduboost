import { useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { placementTestService } from '@/services/placementTest.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowRight,
  CheckCircle,
  XCircle,
  Trophy,
  Loader2,
  Target,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  PlacementQuestionDto,
  AnswerPlacementResponse,
  CompletePlacementResponse,
} from '@/types';

type TestState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'question'; sessionId: string; question: PlacementQuestionDto; questionNumber: number; total: number }
  | { type: 'feedback'; sessionId: string; isCorrect: boolean; response: AnswerPlacementResponse }
  | { type: 'complete'; result: CompletePlacementResponse }
  | { type: 'error'; message: string };

export function AdaptivePlacementTestPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const classId = searchParams.get('classId') || '';

  const [state, setState] = useState<TestState>({ type: 'idle' });
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const startMutation = useMutation({
    mutationFn: () => placementTestService.start(classId),
    onSuccess: (data) => {
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
    onSuccess: (data) => {
      setAnsweredCount((c) => c + 1);
      if (data.isCorrect) setCorrectCount((c) => c + 1);
      if (state.type === 'question') {
        setState({ type: 'feedback', sessionId: state.sessionId, isCorrect: data.isCorrect, response: data });
      }
    },
    onError: () => toast.error('Lỗi khi gửi câu trả lời'),
  });

  const completeMutation = useMutation({
    mutationFn: (sessionId: string) => placementTestService.complete(sessionId),
    onSuccess: (data) => setState({ type: 'complete', result: data }),
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

  const handleNext = useCallback(() => {
    if (state.type !== 'feedback') return;
    const { response, sessionId } = state;
    setSelectedOptions([]);

    if (response.isComplete || !response.nextQuestion) {
      completeMutation.mutate(sessionId);
    } else {
      setState({
        type: 'question',
        sessionId,
        question: response.nextQuestion,
        questionNumber: response.questionNumber,
        total: response.totalQuestions,
      });
    }
  }, [state, completeMutation]);

  // ── Idle ──
  if (state.type === 'idle') {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardHeader className="text-center">
            <Target className="mx-auto h-12 w-12 text-primary" />
            <CardTitle className="mt-4">Bài kiểm tra đầu vào thích ứng</CardTitle>
            <p className="text-muted-foreground">
              Hệ thống sẽ điều chỉnh độ khó câu hỏi theo câu trả lời của bạn để xác định trình độ chính xác nhất.
            </p>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button size="lg" onClick={handleStart} disabled={!classId}>
              Bắt đầu kiểm tra
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
    const { question, questionNumber, total } = state;
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">Câu {questionNumber}/{total}</Badge>
          <Badge variant="outline">{question.difficulty}</Badge>
        </div>
        <Progress value={(answeredCount / total) * 100} className="h-2" />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-lg font-medium">{question.text}</p>
            <div className="space-y-2">
              {question.options.map((opt) => (
                <button
                  key={opt.id}
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
              Xác nhận
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Feedback ──
  if (state.type === 'feedback') {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardContent className="space-y-4 pt-6 text-center">
            {state.isCorrect ? (
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            ) : (
              <XCircle className="mx-auto h-12 w-12 text-destructive" />
            )}
            <p className="text-lg font-semibold">
              {state.isCorrect ? 'Chính xác!' : 'Chưa đúng'}
            </p>
            <p className="text-sm text-muted-foreground">
              {state.isCorrect
                ? 'Câu tiếp theo sẽ khó hơn để đánh giá trình độ chính xác.'
                : 'Câu tiếp theo sẽ dễ hơn để xác định mức độ phù hợp.'}
            </p>
            <Button className="w-full" onClick={handleNext}>
              {state.response.isComplete ? 'Xem kết quả' : 'Câu tiếp theo'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Complete / Results ──
  if (state.type === 'complete') {
    const { result } = state;
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardHeader className="text-center">
            <Trophy className="mx-auto h-12 w-12 text-yellow-500" />
            <CardTitle>Kết quả đánh giá</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <Badge className="text-lg px-4 py-2">{result.initialLevel}</Badge>
              <p className="mt-2 text-muted-foreground">
                Điểm: {Math.round(result.finalScore * 100)}%
              </p>
            </div>

            {result.strengths.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-medium text-green-600">
                  <TrendingUp className="h-4 w-4" /> Điểm mạnh
                </h3>
                <div className="space-y-1">
                  {result.strengths.map((s) => (
                    <div key={s.topicId} className="flex items-center justify-between rounded bg-green-50 px-3 py-2 dark:bg-green-950/20">
                      <span className="text-sm">{s.topicName}</span>
                      <span className="text-sm font-medium text-green-600">{Math.round(s.score * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.weaknesses.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-medium text-orange-600">
                  <TrendingDown className="h-4 w-4" /> Cần cải thiện
                </h3>
                <div className="space-y-1">
                  {result.weaknesses.map((w) => (
                    <div key={w.topicId} className="flex items-center justify-between rounded bg-orange-50 px-3 py-2 dark:bg-orange-950/20">
                      <span className="text-sm">{w.topicName}</span>
                      <span className="text-sm font-medium text-orange-600">{Math.round(w.score * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button className="w-full" onClick={() => navigate('/student/dashboard')}>
              Về trang chính
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
