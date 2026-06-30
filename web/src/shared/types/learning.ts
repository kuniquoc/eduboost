export type RoadmapStepStatus = 'completed' | 'in_progress' | 'recommended' | 'locked';

export interface RoadmapStepDto {
  id: string;
  topicId: string;
  topicName: string;
  status: RoadmapStepStatus;
  progress: number;
  reason?: string;
  mastery?: number;
  theta?: number;
  topicBeta?: number;
  dueCount?: number;
  orderIndex: number;
}

export interface RoadmapDto {
  classId: string;
  studentId: string;
  generatedAt: string;
  steps: RoadmapStepDto[];
}

type TutorAction = 'EXPLAIN' | 'QUIZ' | 'NEXT_SKILL';

export interface TutorNextActionDto {
  action: TutorAction;
  adapter?: string;
  reason: string;
  params?: Record<string, unknown>;
}

export interface TutorQuestionDto {
  questionId: string;
  question: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation: string;
  irtBeta: number;
}

export interface TutorAnswerRequest {
  topicId: string;
  questionId: string;
  selectedAnswer: string;
}

export interface TutorAnswerResult {
  isCorrect: boolean;
  mastery?: string;
  explanation?: string;
  nextAction?: string;
}

export interface ExplainErrorRequest {
  question: string;
  correctAnswer?: string;
  questionId?: string;
  options?: Array<{ id: string; text: string }>;
  studentAnswer?: string;
}
