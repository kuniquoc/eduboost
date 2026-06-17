import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Lightbulb,
  BookOpen,
  Sparkles,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { normalizeText } from '@/utils/text-normalization';

export interface QuizFeedbackOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface QuizAnswerFeedbackProps {
  questionText: string;
  options: QuizFeedbackOption[];
  selectedOptionIds: string[];
  isCorrect: boolean;
  correctAnswerText?: string;
  correctOptionId?: string;
  explanation?: string;
  variant?: 'live' | 'review';
  masteryLabel?: string;
  continueLabel?: string;
  onContinue?: () => void;
  onRequestDetailedExplanation?: () => Promise<string | void>;
  detailedExplanation?: string;
  isLoadingDetailedExplanation?: boolean;
  detailedExplanationError?: boolean;
  detailedExplanationUnavailable?: boolean;
  onRetryDetailedExplanation?: () => void;
}

export function QuizAnswerFeedback({
  questionText,
  options,
  selectedOptionIds,
  isCorrect,
  correctAnswerText,
  correctOptionId,
  explanation,
  variant = 'live',
  masteryLabel,
  continueLabel = 'Câu tiếp theo',
  onContinue,
  onRequestDetailedExplanation,
  detailedExplanation,
  isLoadingDetailedExplanation,
  detailedExplanationError,
  detailedExplanationUnavailable,
  onRetryDetailedExplanation,
}: QuizAnswerFeedbackProps) {
  const [showQuizExplanation, setShowQuizExplanation] = useState(!!explanation && variant === 'review');
  const [showAiHint, setShowAiHint] = useState(false);

  const resolvedCorrectOptionId =
    correctOptionId ?? options.find((o) => o.isCorrect)?.id ?? options.find((o) => o.text === correctAnswerText)?.id;

  const handleToggleDetailedExplanation = async () => {
    const next = !showAiHint;
    setShowAiHint(next);
    if (next && onRequestDetailedExplanation && !detailedExplanation && !isLoadingDetailedExplanation) {
      await onRequestDetailedExplanation();
    }
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center gap-3">
        {isCorrect ? (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-green-600 dark:text-green-400">Chính xác!</h3>
              <p className="text-xs text-muted-foreground">Bạn đã trả lời đúng</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-destructive">Chưa đúng</h3>
              <p className="text-xs text-muted-foreground">Xem giải thích bên dưới</p>
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-background/50 p-4">
        <p className="mb-3 text-sm font-medium">{normalizeText(questionText)}</p>
        <div className="space-y-2">
          {options.map((opt) => {
            const isCorrectOpt = opt.id === resolvedCorrectOptionId || opt.isCorrect === true;
            const isStudentPick = selectedOptionIds.includes(opt.id);
            const shouldShowCorrect = isCorrect || showQuizExplanation || variant === 'review';
            let cls = 'border-border text-muted-foreground';
            if (isCorrectOpt && shouldShowCorrect) cls = 'border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400';
            else if (isStudentPick && !isCorrect) cls = 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 line-through';
            else if (isStudentPick && isCorrect) cls = 'border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400';

            return (
              <div key={opt.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
                <span className="flex-1">{normalizeText(opt.text)}</span>
                {isCorrectOpt && shouldShowCorrect && <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />}
                {isStudentPick && !isCorrect && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
              </div>
            );
          })}
        </div>
      </div>

      {showQuizExplanation && explanation && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 animate-in fade-in duration-300">
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Giải thích</span>
          </div>
          <p className="text-sm leading-relaxed text-foreground/80">{normalizeText(explanation)}</p>
        </div>
      )}

      {showAiHint && (
        <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent p-4 animate-in fade-in duration-300">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-medium text-violet-600 dark:text-violet-400">AI gợi ý</span>
          </div>
          {isLoadingDetailedExplanation && (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
              <span>Gia sư AI đang chuẩn bị gợi ý...</span>
            </div>
          )}
          {detailedExplanationUnavailable && (
            <div className="py-2 text-sm text-muted-foreground">
              Gia sư AI hiện không khả dụng.
            </div>
          )}
          {detailedExplanationError && !detailedExplanationUnavailable && (
            <div className="py-2 text-sm text-destructive">
              <span>Không thể tải AI gợi ý. </span>
              {onRetryDetailedExplanation && (
                <button
                  type="button"
                  onClick={onRetryDetailedExplanation}
                  className="ml-1 font-medium text-violet-600 underline hover:text-violet-500 dark:text-violet-400"
                >
                  Thử lại
                </button>
              )}
            </div>
          )}
          {detailedExplanation && !isLoadingDetailedExplanation && (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-foreground/90 dark:prose-invert">
              {normalizeText(detailedExplanation)}
            </div>
          )}
        </div>
      )}

      {masteryLabel && (
        <div className="text-xs text-muted-foreground">
          Tiến độ: <Badge variant="outline" className="ml-1">{masteryLabel}</Badge>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {explanation && !showQuizExplanation && (
          <Button variant="outline" size="sm" onClick={() => setShowQuizExplanation(true)} className="gap-2">
            <BookOpen className="h-4 w-4" />
            Xem giải thích
          </Button>
        )}
        {onRequestDetailedExplanation && (
          <Button
            variant={showAiHint ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleToggleDetailedExplanation}
            disabled={isLoadingDetailedExplanation}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4 text-violet-500" />
            {showAiHint
              ? 'Ẩn AI gợi ý'
              : isLoadingDetailedExplanation
                ? 'Đang tải...'
                : 'AI gợi ý'}
          </Button>
        )}
        {variant === 'live' && onContinue && (
          <Button className="ml-auto gap-2" onClick={onContinue}>
            {continueLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
