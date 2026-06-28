import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/shared/ui/sonner';
import { useAuthStore } from '@/features/auth/auth-store';

// Layouts — keep eager (small, needed on every protected route)
import { AuthLayout } from '@/app/layouts/auth-layout';
import { AppLayout } from '@/app/layouts/app-layout';
import { ProtectedRoute } from '@/app/layouts/protected-route';

// Public pages — eager (first paint)
import { LandingPage } from '@/features/landing/pages/landing-page';
import { LoginPage } from '@/features/auth/pages/login-page';
import { RegisterPage } from '@/features/auth/pages/register-page';

// Heavy / role-specific pages — lazy-loaded
const TeacherClassesPage = lazy(() =>
  import('@/features/classes/pages/teacher/classes-page').then((m) => ({ default: m.TeacherClassesPage })),
);
const TeacherClassDetailPage = lazy(() =>
  import('@/features/classes/pages/teacher/class-detail-page').then((m) => ({ default: m.TeacherClassDetailPage })),
);
const QuizReviewPage = lazy(() =>
  import('@/features/quizzes/pages/teacher-quiz-review-page').then((m) => ({ default: m.QuizReviewPage })),
);
const TeacherPoolDashboard = lazy(() =>
  import('@/features/quiz-pool/pages/teacher-pool-dashboard').then((m) => ({ default: m.TeacherPoolDashboard })),
);
const ProfilePage = lazy(() =>
  import('@/features/profile/pages/profile-page').then((m) => ({ default: m.ProfilePage })),
);
const StudentDashboardPage = lazy(() =>
  import('@/features/dashboard/pages/student-dashboard-page').then((m) => ({ default: m.StudentDashboardPage })),
);
const StudentClassesPage = lazy(() =>
  import('@/features/classes/pages/student/classes-page').then((m) => ({ default: m.StudentClassesPage })),
);
const StudentClassDetailPage = lazy(() =>
  import('@/features/classes/pages/student/class-detail-page').then((m) => ({ default: m.StudentClassDetailPage })),
);
const AILabPage = lazy(() =>
  import('@/features/ai-lab/pages/ai-lab-page').then((m) => ({ default: m.AILabPage })),
);
const PlacementTestPage = lazy(() =>
  import('@/features/placement-test/pages/placement-test-page').then((m) => ({ default: m.PlacementTestPage })),
);
const EntryTestRedirect = lazy(() =>
  import('@/features/placement-test/pages/entry-test-redirect').then((m) => ({ default: m.EntryTestRedirect })),
);
const StudentClassTabRedirect = lazy(() =>
  import('@/features/classes/pages/student/class-tab-redirect').then((m) => ({ default: m.StudentClassTabRedirect })),
);
const PracticePage = lazy(() =>
  import('@/features/practice/pages/practice-page').then((m) => ({ default: m.PracticePage })),
);
const AILabQuizPage = lazy(() =>
  import('@/features/ai-lab/pages/ai-lab-quiz-page').then((m) => ({ default: m.AILabQuizPage })),
);
const StudentPoolDashboard = lazy(() =>
  import('@/features/quiz-pool/pages/student-pool-dashboard').then((m) => ({ default: m.StudentPoolDashboard })),
);
const PracticeSessionPage = lazy(() =>
  import('@/features/practice/pages/practice-session-page').then((m) => ({ default: m.PracticeSessionPage })),
);
const AiChatPage = lazy(() =>
  import('@/features/ai-chat/pages/ai-chat-page').then((m) => ({ default: m.AiChatPage })),
);
const AdminDashboardPage = lazy(() =>
  import('@/features/admin/pages/admin-dashboard-page').then((m) => ({ default: m.AdminDashboardPage })),
);

function PageLoader() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function AppRoutes() {
  const { initialize, isLoading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Teacher */}
        <Route element={<ProtectedRoute role="teacher" />}>
          <Route element={<AppLayout role="teacher" />}>
            <Route path="/teacher" element={<Navigate to="/teacher/classes" replace />} />
            <Route path="/teacher/classes" element={<TeacherClassesPage />} />
            <Route path="/teacher/classes/:id" element={<TeacherClassDetailPage />} />
            <Route path="/teacher/ai-studio/:quizId" element={<QuizReviewPage />} />
            <Route path="/teacher/quiz-pool" element={<TeacherPoolDashboard />} />
            <Route path="/teacher/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Student */}
        <Route element={<ProtectedRoute role="student" />}>
          <Route element={<AppLayout role="student" />}>
            <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
            <Route path="/student/dashboard" element={<StudentDashboardPage />} />
            <Route path="/student/classes" element={<StudentClassesPage />} />
            <Route path="/student/classes/:classId/quizzes" element={<StudentClassTabRedirect tab="quizzes" />} />
            <Route path="/student/classes/:classId" element={<StudentClassDetailPage />} />
            <Route path="/student/ai-lab" element={<AILabPage />} />
            <Route path="/student/ai-lab/:quizId" element={<AILabQuizPage />} />
            <Route path="/student/quiz-pool" element={<StudentPoolDashboard />} />
            <Route path="/student/ai-chat" element={<AiChatPage />} />
            <Route path="/student/practice-session" element={<PracticeSessionPage />} />
            <Route path="/student/roadmap/:classId" element={<StudentClassTabRedirect tab="practice" />} />
            <Route path="/student/practice/:topicId" element={<PracticePage />} />
            <Route path="/student/profile" element={<ProfilePage />} />
          </Route>
          <Route path="/student/placement-test/:classId" element={<PlacementTestPage />} />
          <Route path="/student/entry-test/:classId" element={<EntryTestRedirect />} />
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute role="admin" />}>
          <Route element={<AppLayout role="admin" />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export function AppRouter() {
  return (
    <>
      <AppRoutes />
      <Toaster richColors position="top-right" />
    </>
  );
}
