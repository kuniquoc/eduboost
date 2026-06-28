import { describe, expect, it } from 'vitest';
import {
  initialPracticeSessionState,
  replacePracticeSessionState,
  resolvePracticeSessionMode,
} from '@/features/practice/model/practice-session-state';

describe('resolvePracticeSessionMode', () => {
  it('đọc fixed mode và bỏ question id rỗng', () => {
    const mode = resolvePracticeSessionMode(
      new URLSearchParams('mode=fixed&topicId=topic-1&questionIds=q1,,q2'),
    );

    expect(mode.autoStart).toBe(true);
    expect(mode.label).toBe('Quiz Pool');
    expect(mode.fixedQuestionIds).toEqual(['q1', 'q2']);
  });

  it('chỉ bật self practice khi có cả lớp và chủ đề', () => {
    expect(resolvePracticeSessionMode(new URLSearchParams('mode=self_practice&classId=c1')).autoStart).toBe(false);
    expect(
      resolvePracticeSessionMode(
        new URLSearchParams('mode=self_practice&classId=c1&topicId=t1'),
      ).isSelfPractice,
    ).toBe(true);
  });
});

describe('replacePracticeSessionState', () => {
  it('thay nguyên trạng thái để tránh state không hợp lệ giữa các bước', () => {
    const next = { type: 'error' as const, message: 'Không tải được phiên' };
    expect(replacePracticeSessionState(initialPracticeSessionState, next)).toBe(next);
  });
});
