// Shared TypeScript types — ported from mobile

export type UserRole = 'teacher' | 'student' | 'admin';

export interface User {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  createdAt?: string;
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
  activeEntryTestId?: string;
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

export type DocumentStatus = 'pending' | 'uploading' | 'ingesting' | 'processing' | 'ready' | 'ingest_failed' | 'error';

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
  isVisible: boolean;
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
  documentId?: string;
  quizId?: string;
  topicName?: string;
  status: 'queued' | 'processing' | 'done' | 'error' | 'completed';
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
  difficultyIndex?: number;
  isEstimatedDifficultyIndex?: boolean;
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
  correctAnswer?: string;
}

// ─── Manual Quiz Creation ─────────────────────────────────

export interface CreateQuestionPayload {
  text: string;
  type: QuestionType;
  difficulty: 'easy' | 'medium' | 'hard';
  difficultyIndex?: number;
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
  needAttentionCount?: number;
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

// ─── AI Tutor (Adaptive Learning) ─────────────────────────

export type TutorAction = 'EXPLAIN' | 'QUIZ' | 'NEXT_SKILL';

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
  difficultyLevel: number;
}

export interface TutorAnswerRequest {
  topicId: string;
  questionId: string;
  questionText: string;
  selectedAnswer: string;
  difficulty: number;
  responseTimeSeconds?: number;
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
  topicsStudiedCount: number;
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
  questionText: string;
  nextReviewDate: string;
  lastReviewDate?: string;
  retentionScore: number;
  repetitionCount: number;
  reviewInterval: number;
  easeFactor: number;
  overdueHours?: number;
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

// ─── Practice Sessions ────────────────────────────────────

export interface PracticeQuestionDto {
  questionId: string;
  text: string;
  type: QuestionType;
  difficulty: string;
  difficultyIndex?: number;
  options: Array<{ id: string; text: string }>;
}

export interface StartPracticeResponse {
  sessionId: string;
  topicName: string;
  question: PracticeQuestionDto;
  questionNumber: number;
  totalQuestions: number;
}

export interface SrUpdateDto {
  nextReviewDate: string;
  reviewInterval: number;
  repetitionCount: number;
  intervalChanged: boolean;
  previousInterval: number;
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
  spacedRepetition?: SrUpdateDto;
  agentAction?: 'EXPLAIN' | 'QUIZ' | 'NEXT_SKILL';
  agentReason?: string;
  agentExplanation?: string;
  recommendNextSkill?: boolean;
  nextSkillSuggestion?: string;
  thetaBefore?: number;
  thetaAfter?: number;
  questionBeta?: number;
  targetBeta?: number;
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
  topicId?: string;
  topicName: string;
  classId?: string;
  userSuggestion?: string;
  documentId?: string;
  numQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  /** "append" (default) adds to existing pool; "replace" deletes owner's existing quizzes in the topic first */
  mode?: 'append' | 'replace';
  numEasyQuestions?: number;
  numMediumQuestions?: number;
  numHardQuestions?: number;
}

export interface CreateTestFromPoolRequest {
  title: string;
  classId: string;
  poolQuizIds: string[];
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
