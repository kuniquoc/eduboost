interface WeakSkillDto {
  topicId: string;
  topicName: string;
  score: number;
}

interface QuizAttemptStatDto {
  quizId: string;
  quizTitle: string;
  attemptCount: number;
  correctCount: number;
  totalQuestions: number;
  correctRatio: number;
}

interface TopicMasteryDto {
  topicId: string;
  topicName: string;
  masteryProbability: number;
  irtTheta: number;
}

export interface StudentAnalyticsDto {
  studentId: string;
  studentName: string;
  email: string;
  avatar?: string;
  completionPercent: number;
  quizzesTaken: number;
  averageScore: number;
  correctRatio: number;
  weakSkills: WeakSkillDto[];
  quizAttemptStats: QuizAttemptStatDto[];
  topicMasteries: TopicMasteryDto[];
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

interface EnrolledClassProgress {
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
