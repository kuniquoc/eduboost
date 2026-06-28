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
