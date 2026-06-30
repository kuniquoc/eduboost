import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PoolQuestionPicker } from './pool-question-picker';

afterEach(cleanup);

vi.mock('@/features/quiz-pool/hooks/use-pool-topics', () => ({
  usePoolTopics: () => ({
    data: [{
      id: 'topic-1',
      name: 'Grammar',
      description: '',
      difficulty: 'medium',
      quizCount: 1,
      questionCount: 0,
    }],
    isLoading: false,
  }),
}));

vi.mock('@/features/quiz-pool/hooks/use-quizzes-in-topic', () => ({
  useQuizzesInTopic: () => ({
    data: [{
      quizId: 'quiz-1',
      title: 'Present perfect',
      createdAt: '2026-07-01T00:00:00Z',
      questions: [],
    }],
    isLoading: false,
  }),
}));

function renderPicker(
  onReviewQuiz?: (quizId: string) => void,
  onSelectionChange: () => void = () => undefined,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PoolQuestionPicker
        selectionMode="batch"
        selectedQuestionIds={[]}
        selectedPoolQuizIds={[]}
        onSelectionChange={onSelectionChange}
        onReviewQuiz={onReviewQuiz}
      />
    </QueryClientProvider>,
  );
}

describe('PoolQuestionPicker review action', () => {
  it('calls the review callback with the selected quiz id', () => {
    const onReviewQuiz = vi.fn();
    const onSelectionChange = vi.fn();
    renderPicker(onReviewQuiz, onSelectionChange);

    fireEvent.click(screen.getByRole('button', { name: 'Kiểm duyệt Present perfect' }));

    expect(onReviewQuiz).toHaveBeenCalledOnce();
    expect(onReviewQuiz).toHaveBeenCalledWith('quiz-1');
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('does not show the review action when no callback is provided', () => {
    renderPicker();

    expect(screen.queryByRole('button', { name: /Kiểm duyệt/ })).not.toBeInTheDocument();
  });
});
