import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { quizzesService } from '@/features/quizzes/api/quizzes.service';

export interface AiExplanationInput {
  key: string;
  question: string;
  options: Array<{ id: string; text: string }>;
  correctAnswer?: string;
  questionId?: string;
}

export function useAiExplanation({
  notifyOnError = false,
  storeOfflineExplanation = false,
}: {
  notifyOnError?: boolean;
  storeOfflineExplanation?: boolean;
} = {}) {
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [offline, setOffline] = useState<Record<string, boolean>>({});
  const [loadingFor, setLoadingFor] = useState<string | null>(null);

  const request = useCallback(async (input: AiExplanationInput) => {
    setLoadingFor(input.key);
    setErrors((current) => ({ ...current, [input.key]: false }));
    setOffline((current) => ({ ...current, [input.key]: false }));
    try {
      const response = await quizzesService.getErrorExplanation({
        question: input.question,
        options: input.options,
        ...(input.correctAnswer ? { correctAnswer: input.correctAnswer } : {}),
        ...(input.questionId ? { questionId: input.questionId } : {}),
      });
      if (response.offline) {
        setOffline((current) => ({ ...current, [input.key]: true }));
        if (!storeOfflineExplanation) return undefined;
      }
      setExplanations((current) => ({ ...current, [input.key]: response.explanation }));
      return response.explanation;
    } catch {
      setErrors((current) => ({ ...current, [input.key]: true }));
      if (notifyOnError) toast.error('Không thể tải AI gợi ý');
      throw new Error('Failed');
    } finally {
      setLoadingFor(null);
    }
  }, [notifyOnError, storeOfflineExplanation]);

  return { explanations, errors, offline, loadingFor, request };
}
