import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuizAnswerFeedback } from './quiz-answer-feedback';

describe('QuizAnswerFeedback', () => {
  it('normalizes arrows in quiz and Socratic explanations', () => {
    const { container } = render(
      <QuizAnswerFeedback
        questionText="Question"
        options={[{ id: 'A', text: 'Answer', isCorrect: true }]}
        selectedOptionIds={['A']}
        isCorrect
        explanation="Quy tắc $\rightarrow$ đáp án"
        detailedExplanation="Gợi ý Socratic $\rightarrow$ tự kiểm tra"
        variant="review"
        onRequestDetailedExplanation={async () => undefined}
      />,
    );

    expect(container).toHaveTextContent('Quy tắc → đáp án');

    fireEvent.click(screen.getByRole('button', { name: 'AI gợi ý' }));

    expect(container).toHaveTextContent('Gợi ý Socratic → tự kiểm tra');
    expect(container.textContent).not.toContain('$\\rightarrow$');
  });
});
