# EduBoost Web — Technical Specification

## 1. Tech Stack

| Layer          | Technology                              |
| -------------- | --------------------------------------- |
| Framework      | React 19 + TypeScript                   |
| Build Tool     | Vite                                    |
| Routing        | React Router v7                         |
| UI Components  | shadcn/ui + Radix UI primitives         |
| Styling        | Tailwind CSS v4                         |
| Icons          | Lucide React                            |
| State (Client) | Zustand                                 |
| State (Server) | TanStack React Query v5                 |
| HTTP Client    | Axios                                   |
| Toasts         | Sonner                                  |
| Charts         | Recharts (analytics)                    |
| Utils          | clsx, tailwind-merge, date-fns          |

---

## 2. Project Structure

```
web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── components.json              ← shadcn/ui config
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx                  ← React entry point
    ├── App.tsx                   ← Router + Providers
    ├── index.css                 ← Tailwind imports + CSS vars
    │
    ├── components/
    │   ├── ui/                   ← shadcn/ui components (auto-generated)
    │   │   ├── button.tsx
    │   │   ├── card.tsx
    │   │   ├── input.tsx
    │   │   ├── dialog.tsx
    │   │   ├── dropdown-menu.tsx
    │   │   ├── badge.tsx
    │   │   ├── progress.tsx
    │   │   ├── switch.tsx
    │   │   ├── table.tsx
    │   │   ├── tabs.tsx
    │   │   ├── toast.tsx / sonner.tsx
    │   │   └── ...
    │   ├── layout/
    │   │   ├── sidebar.tsx       ← Collapsible sidebar navigation
    │   │   ├── header.tsx        ← Top bar (user info, logout)
    │   │   ├── auth-layout.tsx   ← Centered card for login/register
    │   │   ├── app-layout.tsx    ← Sidebar + Header + Main content
    │   │   └── protected-route.tsx ← Auth + role guard
    │   └── shared/
    │       ├── difficulty-badge.tsx
    │       ├── status-badge.tsx
    │       ├── empty-state.tsx
    │       ├── loading-skeleton.tsx
    │       └── file-upload.tsx   ← Drag & drop upload component
    │
    ├── features/
    │   ├── auth/
    │   │   ├── login-page.tsx
    │   │   └── register-page.tsx
    │   ├── landing/
    │   │   └── landing-page.tsx
    │   ├── teacher/
    │   │   ├── classes/
    │   │   │   ├── classes-page.tsx
    │   │   │   ├── class-detail-page.tsx
    │   │   │   ├── create-class-dialog.tsx
    │   │   │   └── edit-class-dialog.tsx
    │   │   ├── topics/
    │   │   │   ├── topics-tab.tsx
    │   │   │   ├── create-topic-dialog.tsx
    │   │   │   └── topic-row.tsx
    │   │   ├── documents/
    │   │   │   ├── documents-tab.tsx
    │   │   │   └── upload-document-dialog.tsx
    │   │   ├── quizzes/
    │   │   │   ├── quiz-review-page.tsx
    │   │   │   └── question-card.tsx
    │   │   ├── students/
    │   │   │   ├── students-tab.tsx
    │   │   │   ├── student-analytics-page.tsx
    │   │   │   └── class-analytics-tab.tsx
    │   │   └── profile/
    │   │       └── profile-page.tsx
    │   └── student/
    │       ├── dashboard/
    │       │   └── dashboard-page.tsx
    │       ├── classes/
    │       │   ├── classes-page.tsx
    │       │   └── join-class-dialog.tsx
    │       ├── entry-test/
    │       │   └── entry-test-page.tsx
    │       ├── placement-test/
    │       │   └── adaptive-placement-test-page.tsx  ← Adaptive test (BKT init)
    │       ├── roadmap/
    │       │   └── roadmap-page.tsx
    │       ├── practice/
    │       │   └── practice-page.tsx
    │       ├── practice-session/
    │       │   └── practice-session-page.tsx  ← BKT + Spaced Repetition practice
    │       ├── ai-chat/
    │       │   └── ai-chat-page.tsx           ← RAG-based AI chat
    │       ├── review/
    │       │   └── review-page.tsx            ← Spaced repetition review
    │       ├── ai-lab/
    │       │   ├── ai-lab-page.tsx
    │       │   └── my-quiz-review-page.tsx
    │       └── profile/
    │           └── profile-page.tsx
    │
    ├── features/
    │   └── admin/
    │       └── admin-dashboard-page.tsx       ← System stats + user management
    │
    ├── services/
    │   ├── api.ts                ← Axios instance + interceptors
    │   ├── auth.service.ts
    │   ├── classes.service.ts
    │   ├── topics.service.ts
    │   ├── documents.service.ts
    │   ├── quizzes.service.ts
    │   ├── roadmap.service.ts
    │   ├── students.service.ts
    │   ├── learningState.service.ts     ← BKT states + review schedule
    │   ├── placementTest.service.ts     ← Adaptive placement test
    │   ├── learningPath.service.ts      ← Personalized learning paths
    │   ├── practiceSession.service.ts   ← Practice sessions (BKT+SR)
    │   ├── aiChat.service.ts            ← AI Q&A with history
    │   ├── admin.service.ts             ← Admin user mgmt + stats
    │   └── userProfile.service.ts       ← User profile CRUD
    │
    ├── store/
    │   └── auth-store.ts         ← Zustand auth state
    │
    ├── types/
    │   └── index.ts              ← Shared TypeScript types (port from mobile)
    │
    ├── hooks/
    │   ├── use-auth.ts           ← Auth convenience hook
    │   └── use-file-upload.ts    ← File upload with progress
    │
    └── lib/
        ├── utils.ts              ← cn() helper, formatDate, etc.
        └── constants.ts          ← Routes, role constants
```

---

## 3. Routing

### Route Map

```
/                          → LandingPage (public)
/login                     → LoginPage (public, redirect if auth)
/register                  → RegisterPage (public, redirect if auth)

/teacher                   → AppLayout (teacher guard)
  /teacher/classes         → ClassesPage
  /teacher/classes/:id     → ClassDetailPage (tabs: topics, docs, students)
  /teacher/ai-studio/:quizId → QuizReviewPage
  /teacher/quiz-pool       → TeacherPoolDashboard
  /teacher/profile         → ProfilePage

/student                   → AppLayout (student guard)
  /student/dashboard       → DashboardPage
  /student/classes         → ClassesPage
  /student/entry-test/:classId → EntryTestPage (legacy)
  /student/placement-test  → AdaptivePlacementTestPage (adaptive, full-page)
  /student/roadmap/:classId → RoadmapPage
  /student/practice/:topicId → PracticePage (AI Tutor flow)
  /student/practice-session → PracticeSessionPage (BKT + SR adaptive)
  /student/ai-chat         → AiChatPage (RAG-based Q&A)
  /student/review          → ReviewPage (Spaced Repetition schedule)
  /student/ai-lab          → AILabPage
  /student/ai-lab/:quizId  → AILabQuizPage
  /student/quiz-pool       → StudentPoolDashboard
  /student/profile         → ProfilePage

/admin                     → AppLayout (admin guard)
  /admin/dashboard         → AdminDashboardPage (stats + user mgmt)
```

### Route Guards

```tsx
// ProtectedRoute component
// 1. Check isAuthenticated → redirect /login if not
// 2. Check role matches → redirect to correct role root if mismatch
//    (teacher → /teacher/classes, student → /student/dashboard, admin → /admin/dashboard)
// 3. Render children if authorized

<Route element={<ProtectedRoute role="teacher" />}>
  <Route path="/teacher/*" element={<AppLayout role="teacher" />}>
    ...
  </Route>
</Route>

<Route element={<ProtectedRoute role="admin" />}>
  <Route path="/admin/*" element={<AppLayout role="admin" />}>
    ...
  </Route>
</Route>
```

---

## 4. State Management

### Auth Store (Zustand)

```typescript
interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  initialize: () => Promise<void>;  // Read localStorage, validate, fetch /me
  setAuth: (user: User) => void;
  logout: () => Promise<void>;
  setLoading: (v: boolean) => void;
}
```

**Token storage**: `localStorage`
- Key `eduboost_access_token` → access token
- Key `eduboost_refresh_token` → refresh token

### Server State (React Query)

Mỗi service function được wrap trong React Query hooks:

```typescript
// Ví dụ: useTeacherClasses
const useTeacherClasses = () =>
  useQuery({
    queryKey: ['teacher', 'classes'],
    queryFn: classesService.getTeacherClasses,
  });

// Ví dụ: useCreateClass
const useCreateClass = () =>
  useMutation({
    mutationFn: classesService.createClass,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teacher', 'classes'] }),
  });
```

**Query Key Convention**:
```
['teacher', 'classes']
['teacher', 'classes', classId]
['teacher', 'classes', classId, 'topics']
['teacher', 'classes', classId, 'documents']
['teacher', 'classes', classId, 'students']
['teacher', 'classes', classId, 'analytics']
['teacher', 'quizzes', quizId, 'questions']

['student', 'classes']
['student', 'progress']
['student', 'stats']
['student', 'roadmap', classId]
['student', 'entry-test', classId]
['student', 'practice', topicId]
['student', 'documents']
['student', 'quizzes', quizId, 'questions']
```

---

## 5. API Client

```typescript
// services/api.ts

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Request interceptor: attach Bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eduboost_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: auto-refresh on 401
// - Queue failed requests while refreshing
// - Retry all queued requests after refresh
// - Logout if refresh fails
```

**Vite Proxy** (development): `/api` → `http://localhost:5000/api`

---

## 6. Theme & Design System

### Color Palette (Dark Theme)

```css
:root {
  /* Brand */
  --primary: #6366F1;
  --primary-light: #818CF8;
  --primary-dark: #4F46E5;

  /* Status */
  --success: #22C55E;
  --warning: #F59E0B;
  --error: #EF4444;

  /* Backgrounds */
  --background: #0F0F14;
  --surface: #1A1A24;
  --card: #22222E;
  --card-hover: #2A2A38;

  /* Borders */
  --border: #2E2E3E;
  --border-light: #3A3A4E;

  /* Text */
  --text: #F4F4F6;
  --text-muted: #8B8B9E;
  --text-disabled: #4B4B5E;
}
```

### Typography

| Token   | Size  | Weight | Use                    |
| ------- | ----- | ------ | ---------------------- |
| h1      | 28px  | 700    | Page titles            |
| h2      | 22px  | 600    | Section headers        |
| h3      | 18px  | 600    | Card titles            |
| h4      | 16px  | 600    | Subsections            |
| body    | 14px  | 400    | Default text           |
| bodyMd  | 15px  | 400    | Slightly larger body   |
| bodySm  | 13px  | 400    | Compact text           |
| caption | 12px  | 400    | Labels, metadata       |

### Spacing Scale

```
xs: 4px, sm: 8px, md: 12px, base: 16px
lg: 20px, xl: 24px, 2xl: 32px, 3xl: 40px, 4xl: 48px
```

### Border Radius

```
sm: 8px, md: 12px, lg: 16px, xl: 20px, full: 9999px
```

---

## 7. Layout Architecture

### App Layout (Teacher/Student)

```
┌──────────────────────────────────────────────┐
│  Sidebar (240px)  │  Header (64px)           │
│                   │──────────────────────────│
│  ┌─────────────┐  │                          │
│  │ Logo        │  │  Main Content Area       │
│  │             │  │                          │
│  │ Nav Items   │  │  ┌────────────────────┐  │
│  │ - Classes   │  │  │  Page Content      │  │
│  │ - AI Studio │  │  │                    │  │
│  │ - Students  │  │  │                    │  │
│  │ - Library   │  │  │                    │  │
│  │ - Profile   │  │  └────────────────────┘  │
│  │             │  │                          │
│  └─────────────┘  │                          │
└──────────────────────────────────────────────┘
```

**Teacher Sidebar Items**:
1. 📚 Lớp học (`/teacher/classes`)
2. 🤖 AI Studio (`/teacher/ai-studio`) — context: select class/quiz
3. 👥 Học sinh (`/teacher/students`) — context: select class
4. 📄 Tài liệu (`/teacher/library`) — context: select class
5. 👤 Hồ sơ (`/teacher/profile`)

**Student Sidebar Items**:
1. 📊 Tổng quan (`/student/dashboard`)
2. 📚 Lớp học (`/student/classes`)
3. 🤖 AI Lab (`/student/ai-lab`)
4. 📝 Luyện tập (`/student/practice`) — context: select topic
5. 👤 Hồ sơ (`/student/profile`)

### Responsive Breakpoints

| Breakpoint | Width    | Sidebar       |
| ---------- | -------- | ------------- |
| Desktop    | ≥1024px  | Expanded      |
| Tablet     | 768-1023 | Collapsed (icons only, expand on hover) |
| Mobile     | <768px   | Hidden (hamburger toggle) |

---

## 8. File Upload Pattern (Web)

```typescript
// hooks/use-file-upload.ts

async function uploadFile(
  file: File,
  requestUploadFn: (payload) => Promise<UploadUrlDto>,
  confirmFn: (docId: string) => Promise<DocumentDto>,
  onProgress?: (percent: number) => void
) {
  // 1. Request presigned URL
  const { uploadUrl, documentId } = await requestUploadFn({
    fileName: file.name,
    fileSize: formatFileSize(file.size),
  });

  // 2. Upload directly to MinIO
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });

  // 3. Confirm upload
  return await confirmFn(documentId);
}
```

---

## 9. Key Implementation Notes

### Entry Test UI
- Full-page layout (no sidebar)
- Question navigation: previous/next buttons + question number grid
- Auto-save answers to local state
- Timer display per question
- Submit confirmation dialog
- Result page with topic breakdown + "Generate Roadmap" CTA

### Quiz Question Editor (Teacher)
- Inline editing mode with save/cancel
- Dynamic options list (add/remove options)
- Radio/checkbox for marking correct answers
- Rich text for question/explanation (optional, can start with plain text)

### Roadmap Visualization
- Vertical stepper/timeline component
- Color-coded step statuses
- Progress bar inside each step
- Click-to-navigate to practice

### Analytics Charts
- Recharts library
- Bar chart: topic scores per student
- Pie chart: completion distribution
- Line chart: weekly progress trend
