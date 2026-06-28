import type { QuestionDto } from '@/features/quizzes/types';

export interface GeneratePoolQuizRequest {
  topicId?: string;
  topicName: string;
  classId?: string;
  userSuggestion?: string;
  documentId?: string;
  numQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  /** `append` thêm câu hỏi; `replace` xóa các đợt sinh cũ của chính chủ sở hữu. */
  mode?: 'append' | 'replace';
  numEasyQuestions?: number;
  numMediumQuestions?: number;
  numHardQuestions?: number;
}

export interface CreateTestFromPoolRequest {
  title: string;
  classId: string;
  poolQuizIds?: string[];
  questionIds?: string[];
  timeLimitMinutes?: number;
  totalScore?: number;
}

export interface CreateEntryTestFromPoolRequest {
  classId: string;
  title?: string;
  questionIds?: string[];
  poolQuizIds?: string[];
}

export interface CreateRevisionSetFromPoolRequest {
  title: string;
  poolQuizIds: string[];
}

export interface TopicPoolDto {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  classId?: string;
  ownerId?: string;
  quizCount: number;
  questionCount: number;
}

export interface PoolQuizDetailDto {
  quizId: string;
  title: string;
  createdAt: string;
  questions: QuestionDto[];
}
