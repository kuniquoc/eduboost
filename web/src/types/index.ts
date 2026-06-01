// Shared TypeScript types — ported from mobile

export type UserRole = 'teacher' | 'student' | 'admin';

export interface User {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ─── Classes ──────────────────────────────────────────────

export interface ClassDto {
  id: string;
  name: string;
  description: string;
  coverColor: string;
  studentCount: number;
  averageProgress: number;
  topicCount: number;
  classCode: string;
  createdAt: string;
  teacherId: string;
}

export interface TopicSummary {
  id: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  aiEvaluated: boolean;
  questionCount: number;
  isDocumentVisible: boolean;
}

export interface ClassDetailDto extends ClassDto {
  topics: TopicSummary[];
}

export interface StudentEnrollmentDto {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  joinedAt: string;
  entryTestCompleted: boolean;
  completionPercent: number;
}

// ─── Topics ──────────────────────────────────────────────

export interface TopicDto {
  id: string;
  classId: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  aiEvaluated: boolean;
  questionCount: number;
  isDocumentVisible: boolean;
  createdAt: string;
}

// ─── Documents ────────────────────────────────────────────

export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'error';

export interface DocumentDto {
  id: string;
  ownerId: string;
  name: string;
  size: string;
  status: DocumentStatus;
  uploadedAt: string;
  topicId?: string;
  generatedQuizId?: string;
  classId?: string;
}

export interface UploadUrlDto {
  uploadUrl: string;
  documentId: string;
}

export interface DownloadUrlDto {
  downloadUrl: string;
  expiresAt: string;
}

export interface GenerateQuizJobDto {
  jobId: string;
  documentId: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  message?: string;
}

// ─── Quizzes ─────────────────────────────────────────────

export type QuestionType = 'mcq' | 'multi_select' | 'fill_blank';
export type AnswerState = 'unanswered' | 'correct' | 'wrong';

export interface OptionDto {
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
  difficulty: 'easy' | 'medium' | 'hard';
  options: OptionDto[];
  correctAnswer?: string;
  explanation?: string;
  verifiedByTeacher: boolean;
  orderIndex: number;
}

export interface QuizAnswer {
  questionId: string;
  selectedOptionIds: string[];
  fillBlankValue?: string;
  state: AnswerState;
  timeSpentSeconds: number;
}

export interface TopicScoreDto {
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
  difficulty?: 'easy' | 'medium' | 'hard';
  explanation?: string;
  options?: Array<{ id?: string; text: string; isCorrect: boolean }>;
}

// ─── Manual Quiz Creation ─────────────────────────────────

export interface CreateQuestionPayload {
  text: string;
  type: QuestionType;
  difficulty: 'easy' | 'medium' | 'hard';
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
  type: 'entry_test' | 'practice' | 'private';
  isPublished: boolean;
  questionCount: number;
  createdAt: string;
}

// ─── Students Analytics ───────────────────────────────────

export interface WeakSkillDto {
  topicId: string;
  topicName: string;
  score: number;
}

export interface StudentAnalyticsDto {
  studentId: string;
  studentName: string;
  email: string;
  avatar?: string;
  completionPercent: number;
  quizzesTaken: number;
  averageScore: number;
  weakSkills: WeakSkillDto[];
  lastActive: string;
  entryTestCompleted: boolean;
}

export interface ClassAnalyticsDto {
  classId: string;
  className: string;
  totalStudents: number;
  avgCompletion: number;
  avgScore: number;
  studentsCompleted: number;
  students: StudentAnalyticsDto[];
}

export interface StudentProgressDto {
  studentId: string;
  overallProgress: number;
  enrolledClasses: EnrolledClassProgress[];
}

export interface EnrolledClassProgress {
  classId: string;
  className: string;
  coverColor: string;
  progress: number;
  entryTestCompleted: boolean;
  joinedAt: string;
}

export interface StudentStatsDto {
  dayStreak: number;
  avgQuizScore: number;
  totalQuizzesTaken: number;
  weeklyProgress: number;
}

// ─── Roadmap ─────────────────────────────────────────────

export type RoadmapStepStatus = 'completed' | 'in_progress' | 'recommended' | 'locked';

export interface RoadmapStepDto {
  id: string;
  topicId: string;
  topicName: string;
  status: RoadmapStepStatus;
  progress: number;
  reason?: string;
  orderIndex: number;
}

export interface RoadmapDto {
  classId: string;
  studentId: string;
  generatedAt: string;
  steps: RoadmapStepDto[];
}

// ─── AI Tutor (Adaptive Learning) ─────────────────────────

export type TutorAction = 'EXPLAIN' | 'QUIZ' | 'NEXT_SKILL';

export interface TutorNextActionDto {
  action: TutorAction;
  adapter?: string;
  reason: string;
  params?: Record<string, unknown>;
}

export interface TutorQuestionDto {
  question: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation: string;
  difficultyLevel: number;
}

export interface TutorAnswerRequest {
  topicId: string;
  questionText: string;
  correctAnswer: string;
  selectedAnswer: string;
  difficulty: number;
}

export interface TutorAnswerResult {
  isCorrect: boolean;
  mastery?: string;
  newProbability?: number;
  newTheta?: number;
  explanation?: string;
  nextAction?: string;
}

export interface ExplainErrorRequest {
  question: string;
  correctAnswer: string;
  studentAnswer: string;
}

// ─── User Profile ─────────────────────────────────────────

export interface UserProfileDto {
  userId: string;
  currentLevel: 'beginner' | 'intermediate' | 'advanced';
  overallMasteryScore: number;
  preferredTopics: string[];
  learningStreak: number;
  lastActiveDate?: string;
}

// ─── BKT / Learning States ────────────────────────────────

export interface BktStateDto {
  topicId: string;
  topicName: string;
  masteryProbability: number;
  guessProbability: number;
  slipProbability: number;
  transitionProbability: number;
  irtTheta: number;
  updatedAt: string;
}

export interface UpdateBktResponse {
  state: BktStateDto;
  recommendation?: string;
}

export interface ReviewScheduleDto {
  totalDueToday: number;
  items: ReviewItemDto[];
}

export interface ReviewItemDto {
  questionId: string;
  topicId: string;
  topicName: string;
  nextReviewDate: string;
  retentionScore: number;
  repetitionCount: number;
}

// ─── Placement Test (Adaptive) ────────────────────────────

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
  isCorrect: boolean;
  isComplete: boolean;
  nextQuestion?: PlacementQuestionDto;
  questionNumber: number;
  totalQuestions: number;
}

export interface CompletePlacementResponse {
  resultId: string;
  initialLevel: string;
  finalScore: number;
  strengths: Array<{ topicId: string; topicName: string; score: number }>;
  weaknesses: Array<{ topicId: string; topicName: string; score: number }>;
}

export interface PlacementTestResultDto {
  id: string;
  initialLevel: string;
  finalScore: number;
  strengths: Array<{ topicId: string; topicName: string; score: number }>;
  weaknesses: Array<{ topicId: string; topicName: string; score: number }>;
  createdAt: string;
}

// ─── Learning Paths ───────────────────────────────────────

export interface LearningPathDto {
  items: LearningPathItemDto[];
  totalItems: number;
  completedItems: number;
  overallProgress: number;
}

export interface LearningPathItemDto {
  id: string;
  topicId: string;
  topicName: string;
  recommendedDifficulty: string;
  priorityScore: number;
  nextReviewDate?: string;
  isCompleted: boolean;
  orderIndex: number;
}

// ─── Practice Sessions ────────────────────────────────────

export interface PracticeQuestionDto {
  questionId: string;
  text: string;
  type: QuestionType;
  difficulty: string;
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
  isCorrect: boolean;
  correctAnswer?: string;
  explanation?: string;
  nextQuestion?: PracticeQuestionDto;
  questionNumber: number;
  isSessionComplete: boolean;
}

export interface PracticeSessionSummary {
  sessionId: string;
  topicName: string;
  questionsAttempted: number;
  correctAnswers: number;
  score: number;
  recommendation?: string;
}

// ─── AI Chat ──────────────────────────────────────────────

export interface AskResponse {
  answer: string;
  sources: SourceReferenceDto[];
  messageId: string;
}

export interface SourceReferenceDto {
  documentId: string;
  fileName: string;
  snippet?: string;
}

export interface ChatMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: SourceReferenceDto[];
  createdAt: string;
}

export interface ChatHistoryDto {
  total: number;
  messages: ChatMessageDto[];
}

// ─── Admin ────────────────────────────────────────────────

export interface AdminUserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface SystemStatsDto {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalTopics: number;
  totalQuestions: number;
  totalLearningSessions: number;
}

// ─── API Response ────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
}

// ─── Quiz Pool ───────────────────────────────────────────

export interface GeneratePoolQuizRequest {
  topicName: string;
  classId?: string;
  userSuggestion?: string;
  documentId?: string;
  numQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface CreateTestFromPoolRequest {
  title: string;
  classId: string;
  poolQuizIds: string[];
  timeLimitMinutes?: number;
  totalScore?: number;
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
