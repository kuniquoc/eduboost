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
  teacherName?: string;
  activeEntryTestId?: string;
  topics: TopicSummary[];
}

export interface ClassmateDto {
  studentId: string;
  name: string;
  avatar?: string;
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
