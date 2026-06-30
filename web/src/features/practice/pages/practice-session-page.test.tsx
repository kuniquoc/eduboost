import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { practiceSessionService } from '@/features/practice/api/practice-session.service';
import { PracticeSessionPage } from './practice-session-page';

vi.mock('@/features/practice/api/practice-session.service', () => ({
  practiceSessionService: {
    start: vi.fn(),
    startFixed: vi.fn(),
    startQuizPractice: vi.fn(),
    startQuizTest: vi.fn(),
    startSelfPractice: vi.fn(),
    submitAnswer: vi.fn(),
    endSession: vi.fn(),
  },
}));

vi.mock('@/features/practice/hooks/use-ai-explanation', () => ({
  useAiExplanation: () => ({
    explanations: {},
    loadingFor: null,
    errors: {},
    offline: {},
    request: vi.fn(),
  }),
}));

vi.mock('@/shared/lib/invalidate-learning-queries', () => ({
  invalidateLearningQueries: vi.fn(),
}));

const question = {
  questionId: 'question-1',
  text: 'Câu hỏi luyện tập',
  type: 'mcq' as const,
  difficultyBand: 'medium',
  irtBeta: 0,
  options: [
    { id: 'A', text: 'Đáp án A' },
    { id: 'B', text: 'Đáp án B' },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/student/practice-session?mode=practice&quizId=quiz-1&topicName=Quiz+l%E1%BB%9Bp']}>
        <PracticeSessionPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PracticeSessionPage', () => {
  beforeEach(() => {
    vi.mocked(practiceSessionService.startQuizPractice).mockResolvedValue({
      sessionId: 'session-1',
      topicName: 'Quiz lớp',
      question,
      questionNumber: 1,
      totalQuestions: 1,
    });
    vi.mocked(practiceSessionService.submitAnswer).mockResolvedValue({
      isCorrect: true,
      correctAnswer: 'Đáp án A',
      questionNumber: 1,
      isSessionComplete: true,
      totalQuestions: 1,
    });
    vi.mocked(practiceSessionService.endSession).mockResolvedValue({
      sessionId: 'session-1',
      topicName: 'Quiz lớp',
      questionsAttempted: 1,
      correctAnswers: 1,
      score: 100,
    });
  });

  it('starts a new class quiz session when the student chooses Luyện tiếp', async () => {
    renderPage();

    expect(await screen.findByText('Câu hỏi luyện tập')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đáp án A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xem kết quả' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Luyện tiếp' }));

    await waitFor(() => {
      expect(practiceSessionService.startQuizPractice).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Câu hỏi luyện tập')).toBeInTheDocument();
  });
});
