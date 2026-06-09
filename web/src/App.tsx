import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/store/auth-store';

// Layouts — keep eager (small, needed on every protected route)
import { AuthLayout } from '@/components/layout/auth-layout';
import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute } from '@/components/layout/protected-route';

// Public pages — eager (first paint)
import { LandingPage } from '@/features/landing/landing-page';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';

// Heavy / role-specific pages — lazy-loaded
const TeacherClassesPage = lazy(() =>
  import('@/features/teacher/classes/classes-page').then((m) => ({ default: m.TeacherClassesPage })),
);
const TeacherClassDetailPage = lazy(() =>
  import('@/features/teacher/classes/class-detail-page').then((m) => ({ default: m.TeacherClassDetailPage })),
);
const QuizReviewPage = lazy(() =>
  import('@/features/teacher/quizzes/quiz-review-page').then((m) => ({ default: m.QuizReviewPage })),
);
const TeacherPoolDashboard = lazy(() =>
  import('@/features/teacher/quizzes/pool-dashboard').then((m) => ({ default: m.TeacherPoolDashboard })),
);
const ProfilePage = lazy(() =>
  import('@/features/shared/profile-page').then((m) => ({ default: m.ProfilePage })),
);
const StudentDashboardPage = lazy(() =>
  import('@/features/student/dashboard/dashboard-page').then((m) => ({ default: m.StudentDashboardPage })),
);
const StudentClassesPage = lazy(() =>
  import('@/features/student/classes/classes-page').then((m) => ({ default: m.StudentClassesPage })),
);
const ClassQuizzesPage = lazy(() =>
  import('@/features/student/classes/class-quizzes-page').then((m) => ({ default: m.ClassQuizzesPage })),
);
const AILabPage = lazy(() =>
  import('@/features/student/ai-lab/ai-lab-page').then((m) => ({ default: m.AILabPage })),
);
const PlacementTestPage = lazy(() =>
  import('@/features/student/entry-test/entry-test-page').then((m) => ({ default: m.PlacementTestPage })),
);
const EntryTestRedirect = lazy(() =>
  import('@/features/student/entry-test/entry-test-redirect').then((m) => ({ default: m.EntryTestRedirect })),
);
const RoadmapPage = lazy(() =>
  import('@/features/student/roadmap/roadmap-page').then((m) => ({ default: m.RoadmapPage })),
);
const PracticePage = lazy(() =>
  import('@/features/student/practice/practice-page').then((m) => ({ default: m.PracticePage })),
);
const AILabQuizPage = lazy(() =>
  import('@/features/student/ai-lab/ai-lab-quiz-page').then((m) => ({ default: m.AILabQuizPage })),
);
const StudentPoolDashboard = lazy(() =>
  import('@/features/student/ai-lab/pool-dashboard').then((m) => ({ default: m.StudentPoolDashboard })),
);
const PracticeSessionPage = lazy(() =>
  import('@/features/student/practice-session/practice-session-page').then((m) => ({ default: m.PracticeSessionPage })),
);
const AiChatPage = lazy(() =>
  import('@/features/student/ai-chat/ai-chat-page').then((m) => ({ default: m.AiChatPage })),
);
const ReviewPage = lazy(() =>
  import('@/features/student/review/review-page').then((m) => ({ default: m.ReviewPage })),
);
const AdminDashboardPage = lazy(() =>
  import('@/features/admin/admin-dashboard-page').then((m) => ({ default: m.AdminDashboardPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

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
            <Route path="/student/ai-lab" element={<AILabPage />} />
            <Route path="/student/ai-lab/:quizId" element={<AILabQuizPage />} />
            <Route path="/student/quiz-pool" element={<StudentPoolDashboard />} />
            <Route path="/student/ai-chat" element={<AiChatPage />} />
            <Route path="/student/review" element={<ReviewPage />} />
            <Route path="/student/practice-session" element={<PracticeSessionPage />} />
            <Route path="/student/roadmap/:classId" element={<RoadmapPage />} />
            <Route path="/student/classes/:classId/quizzes" element={<ClassQuizzesPage />} />
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
