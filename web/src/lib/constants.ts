export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',

  // Teacher
  TEACHER_CLASSES: '/teacher/classes',
  TEACHER_CLASS_DETAIL: '/teacher/classes/:id',
  TEACHER_AI_STUDIO: '/teacher/ai-studio/:quizId',
  TEACHER_PROFILE: '/teacher/profile',

  // Student
  STUDENT_DASHBOARD: '/student/dashboard',
  STUDENT_CLASSES: '/student/classes',
  STUDENT_ENTRY_TEST: '/student/entry-test/:classId',
  STUDENT_ROADMAP: '/student/roadmap/:classId',
  STUDENT_PRACTICE: '/student/practice/:topicId',
  STUDENT_AI_LAB: '/student/ai-lab',
  STUDENT_AI_LAB_QUIZ: '/student/ai-lab/:quizId',
  STUDENT_PROFILE: '/student/profile',
} as const;
