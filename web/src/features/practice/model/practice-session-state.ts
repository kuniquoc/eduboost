import type { PracticeQuestionDto, PracticeSessionSummary, QuizReviewItemDto, SubmitPracticeAnswerResponse } from '@/features/practice/types';

export type PracticeSessionState =
  | { type: 'idle' }
  | { type: 'loading' }
  | {
      type: 'answering';
      sessionId: string;
      question: PracticeQuestionDto;
      questionNumber: number;
      total: number;
      phase: 'selecting' | 'reviewing';
      feedback?: SubmitPracticeAnswerResponse;
    }
  | { type: 'summary'; data: PracticeSessionSummary }
  | {
      type: 'review';
      items: QuizReviewItemDto[];
      index: number;
      topicName: string;
      summary: PracticeSessionSummary;
    }
  | { type: 'error'; message: string };

export interface PracticeSessionMode {
  topicId: string;
  classId: string;
  topicName: string;
  quizId: string;
  isFixed: boolean;
  isQuizPractice: boolean;
  isTest: boolean;
  isSelfPractice: boolean;
  autoStart: boolean;
  fixedQuestionIds?: string[];
  label: string;
}

export const initialPracticeSessionState: PracticeSessionState = { type: 'idle' };

export function currentTimeMs(): number {
  return Date.now();
}

export function replacePracticeSessionState(
  _current: PracticeSessionState,
  next: PracticeSessionState,
): PracticeSessionState {
  return next;
}

export function resolvePracticeSessionMode(params: URLSearchParams): PracticeSessionMode {
  const topicId = params.get('topicId') || '';
  const classId = params.get('classId') || '';
  const topicName = params.get('topicName') || '';
  const quizId = params.get('quizId') || '';
  const mode = params.get('mode') || 'standard';
  const isFixed = mode === 'fixed';
  const isQuizPractice = mode === 'practice' && Boolean(quizId);
  const isTest = mode === 'test' && Boolean(quizId);
  const isSelfPractice = mode === 'self_practice' && Boolean(classId) && Boolean(topicId);

  return {
    topicId,
    classId,
    topicName,
    quizId,
    isFixed,
    isQuizPractice,
    isTest,
    isSelfPractice,
    autoStart: isFixed || isQuizPractice || isTest || isSelfPractice,
    fixedQuestionIds: isFixed
      ? params.get('questionIds')?.split(',').filter(Boolean)
      : undefined,
    label: isTest
      ? 'Bài kiểm tra'
      : isSelfPractice
        ? 'Tự luyện tập'
        : isQuizPractice
          ? 'Luyện tập quiz lớp'
          : isFixed
            ? 'Quiz Pool'
            : 'Luyện tập',
  };
}
