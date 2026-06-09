# Routing



> Nguồn: [`web/src/App.tsx`](../../web/src/App.tsx)



## Public



| Path | Component | Status |

|------|-----------|--------|

| `/` | `LandingPage` | ✅ |

| `/login` | `LoginPage` | ✅ |

| `/register` | `RegisterPage` | ✅ |



## Teacher (`ProtectedRoute role="teacher"`)



| Path | Component | Status |

|------|-----------|--------|

| `/teacher` | → `/teacher/classes` | ✅ |

| `/teacher/classes` | `TeacherClassesPage` | ✅ |

| `/teacher/classes/:id` | `TeacherClassDetailPage` | ✅ |

| `/teacher/ai-studio/:quizId` | `QuizReviewPage` | ✅ |

| `/teacher/quiz-pool` | `TeacherPoolDashboard` | ✅ |

| `/teacher/profile` | `ProfilePage` | ✅ |



## Student (`ProtectedRoute role="student"`)



| Path | Component | Sidebar | Status |

|------|-----------|---------|--------|

| `/student` | → `/student/dashboard` | — | ✅ |

| `/student/dashboard` | `StudentDashboardPage` | Yes | ✅ |

| `/student/classes` | `StudentClassesPage` | Yes | ✅ |

| `/student/ai-lab` | `AILabPage` | Yes | ✅ |

| `/student/ai-lab/:quizId` | `AILabQuizPage` | Yes (AppLayout) | ✅ |

| `/student/quiz-pool` | `StudentPoolDashboard` | Yes | ✅ |

| `/student/ai-chat` | `AiChatPage` | Yes | ✅ |

| `/student/review` | `ReviewPage` | Yes | ✅ |

| `/student/practice-session` | `PracticeSessionPage` | Via review/roadmap (query params) | ✅ |

| `/student/roadmap/:classId` | `RoadmapPage` | Via classes | ✅ |

| `/student/practice/:topicId` | `PracticePage` | Via roadmap | ✅ |

| `/student/profile` | `ProfilePage` | Yes | ✅ |

| `/student/placement-test/:classId` | `PlacementTestPage` | No (full page) | ✅ |

| `/student/entry-test/:classId` | → redirect placement-test | — | ✅ legacy |



## Admin (`ProtectedRoute role="admin"`)



| Path | Component | Status |

|------|-----------|--------|

| `/admin` | → `/admin/dashboard` | ✅ |

| `/admin/dashboard` | `AdminDashboardPage` | ✅ |



## Fallback



`*` → redirect `/`



## Sidebar nav ([`app-layout.tsx`](../../web/src/components/layout/app-layout.tsx))



**Teacher:** Lớp học, Quiz Pool, Hồ sơ



**Student:** Tổng quan, Lớp học, AI Chat, AI Lab, Ôn tập, Quiz Pool, Hồ sơ

(Roadmap: `/student/roadmap/:classId` từ trang Lớp học. Practice session: từ Review/Roadmap với `?topicId=`. AI tutor: `/student/practice/:topicId`.)



**Admin:** Tổng quan


