export type QuestionType = 'mcq' | 'multi_select' | 'fill_blank';
interface OptionDto {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionDto {
  id: string;
  quizId: string;
  topicId: string;
  text: string;
  type: QuestionType;
  difficultyBand: 'easy' | 'medium' | 'hard';
  initialIrtBeta: number;
  irtBeta: number;
  irtBetaStandardError?: number;
  irtCalibrationSampleCount: number;
  irtCalibrationStatus: string;
  options: OptionDto[];
  correctAnswer?: string;
  explanation?: string;
  verifiedByTeacher: boolean;
  orderIndex: number;
}

interface TopicScoreDto {
  topicId: string;
  topicName: string;
  score: number;
  total: number;
  percentage: number;
}

export interface QuizResultDto {
  quizId: string;
  score: number;
  total: number;
  percentage: number;
  grade: string;
  topicScores: TopicScoreDto[];
  completedAt: string;
}

export interface EntryTestDto {
  quizId: string;
  classId: string;
  className: string;
  questions: QuestionDto[];
}

export interface SubmitQuizRequest {
  answers: Array<{
    questionId: string;
    selectedOptionIds: string[];
    fillBlankValue?: string;
    timeSpentSeconds: number;
  }>;
}

export interface UpdateQuestionPayload {
  text?: string;
  difficultyBand?: 'easy' | 'medium' | 'hard';
  initialIrtBeta?: number;
  explanation?: string;
  options?: Array<{ id?: string; text: string; isCorrect: boolean }>;
  correctAnswer?: string;
}

export interface CreateQuestionPayload {
  text: string;
  type: QuestionType;
  difficultyBand: 'easy' | 'medium' | 'hard';
  initialIrtBeta?: number;
  explanation?: string;
  correctAnswer?: string;
  options: Array<{ text: string; isCorrect: boolean }>;
}

export interface CreateQuizRequest {
  title: string;
  classId?: string;
  topicId?: string;
  type?: 'practice' | 'entry_test';
  questions: CreateQuestionPayload[];
}

export interface QuizDto {
  id: string;
  classId: string;
  topicId?: string;
  documentId?: string;
  title: string;
  type?: 'entry_test' | 'practice' | 'private' | 'pool';
  isPublished: boolean;
  questionCount: number;
  createdAt: string;
}
