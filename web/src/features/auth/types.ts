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

export interface UserProfileDto {
  userId: string;
  currentLevel: 'beginner' | 'intermediate' | 'advanced';
  overallMasteryScore: number;
  topicsStudiedCount: number;
  preferredTopics: string[];
  learningStreak: number;
  lastActiveDate?: string;
}
