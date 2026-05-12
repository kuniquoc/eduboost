import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/store/auth-store';

// Layouts
import { AuthLayout } from '@/components/layout/auth-layout';
import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute } from '@/components/layout/protected-route';

// Pages
import { LandingPage } from '@/features/landing/landing-page';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { TeacherClassesPage } from '@/features/teacher/classes/classes-page';
import { TeacherClassDetailPage } from '@/features/teacher/classes/class-detail-page';
import { QuizReviewPage } from '@/features/teacher/quizzes/quiz-review-page';
import { ProfilePage } from '@/features/shared/profile-page';
import { StudentDashboardPage } from '@/features/student/dashboard/dashboard-page';
import { StudentClassesPage } from '@/features/student/classes/classes-page';
import { AILabPage } from '@/features/student/ai-lab/ai-lab-page';
import { EntryTestPage } from '@/features/student/entry-test/entry-test-page';
import { RoadmapPage } from '@/features/student/roadmap/roadmap-page';
import { PracticePage } from '@/features/student/practice/practice-page';
import { AILabQuizPage } from '@/features/student/ai-lab/ai-lab-quiz-page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

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
          <Route path="/student/roadmap/:classId" element={<RoadmapPage />} />
          <Route path="/student/practice/:topicId" element={<PracticePage />} />
          <Route path="/student/profile" element={<ProfilePage />} />
        </Route>
        {/* Full-page (no sidebar) */}
        <Route path="/student/entry-test/:classId" element={<EntryTestPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
