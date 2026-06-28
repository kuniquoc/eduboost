import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { quizzesService } from '@/features/quizzes/api/quizzes.service';
import { useAiExplanation } from './use-ai-explanation';

vi.mock('@/features/quizzes/api/quizzes.service', () => ({
  quizzesService: { getErrorExplanation: vi.fn() },
}));

const getExplanation = vi.mocked(quizzesService.getErrorExplanation);

describe('useAiExplanation', () => {
  beforeEach(() => getExplanation.mockReset());

  it('lưu lời giải theo question key', async () => {
    getExplanation.mockResolvedValue({ explanation: 'Gợi ý Socratic', offline: false });
    const { result } = renderHook(() => useAiExplanation());

    await act(() => result.current.request({
      key: 'q1',
      question: 'Question',
      options: [{ id: 'A', text: 'Answer' }],
      questionId: 'q1',
    }));

    expect(result.current.explanations.q1).toBe('Gợi ý Socratic');
    expect(result.current.loadingFor).toBeNull();
  });

  it('đánh dấu offline mà không hiển thị fallback như lời giải AI', async () => {
    getExplanation.mockResolvedValue({ explanation: 'AI đang ngoại tuyến', offline: true });
    const { result } = renderHook(() => useAiExplanation());

    await act(() => result.current.request({ key: 'q2', question: 'Question', options: [] }));

    expect(result.current.offline.q2).toBe(true);
    expect(result.current.explanations.q2).toBeUndefined();
  });
});
