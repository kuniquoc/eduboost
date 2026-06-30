import type { QuestionType } from '@/features/quizzes/types';

export interface PlacementQuestionDto {
  questionId: string;
  text: string;
  type: QuestionType;
  difficulty: string;
  options: Array<{ id: string; text: string }>;
}

export interface StartPlacementTestResponse {
  sessionId: string;
  question: PlacementQuestionDto;
  questionNumber: number;
  totalQuestions: number;
}

export interface AnswerPlacementResponse {
  feedbackSuppressed?: boolean;
  isComplete: boolean;
  nextQuestion?: PlacementQuestionDto;
  questionNumber: number;
  totalQuestions: number;
}

export interface CompletePlacementResponse {
  resultId: string;
  classId?: string;
  initialLevel: string;
  finalScore: number;
  strengths: Array<{ topicId: string; topicName: string; score: number }>;
  weaknesses: Array<{ topicId: string; topicName: string; score: number }>;
  reviewItems?: QuizReviewItemDto[];
}

export interface PlacementTestResultDto {
  id: string;
  classId?: string;
  initialLevel: string;
  finalScore: number;
  strengths: Array<{ topicId: string; topicName: string; score: number }>;
  weaknesses: Array<{ topicId: string; topicName: string; score: number }>;
  createdAt: string;
  reviewItems?: QuizReviewItemDto[];
}

export interface PracticeQuestionDto {
  questionId: string;
  text: string;
  type: QuestionType;
  difficultyBand: string;
  irtBeta: number;
  options: Array<{ id: string; text: string }>;
}

export interface StartPracticeResponse {
  sessionId: string;
  topicName: string;
  question: PracticeQuestionDto;
  questionNumber: number;
  totalQuestions: number;
}

export interface SubmitPracticeAnswerResponse {
  feedbackSuppressed?: boolean;
  isCorrect: boolean;
  correctAnswer?: string;
  explanation?: string;
  nextQuestion?: PracticeQuestionDto;
  questionNumber: number;
  isSessionComplete: boolean;
  totalQuestions?: number;
  agentAction?: 'EXPLAIN' | 'QUIZ' | 'NEXT_SKILL';
  agentReason?: string;
  agentExplanation?: string;
  recommendNextSkill?: boolean;
  nextSkillSuggestion?: string;
  thetaBefore?: number;
  thetaAfter?: number;
  questionBeta?: number;
  targetBeta?: number;
  sessionMastery?: number;
  dbMasteryBaseline?: number;
  suggestedNextTopicId?: string;
  suggestedNextTopicName?: string;
}

export interface QuizReviewItemDto {
  questionId: string;
  text: string;
  type: QuestionType;
  options: Array<{ id: string; text: string }>;
  selectedOptionId?: string;
  correctOptionId?: string;
  correctAnswer?: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface PracticeSessionSummary {
  sessionId: string;
  topicName: string;
  questionsAttempted: number;
  correctAnswers: number;
  score: number;
  masteryChange?: number;
  recommendation?: string;
  itemsReviewed?: number;
  nextReviewSummary?: string;
  reviewItems?: QuizReviewItemDto[];
}
