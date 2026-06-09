# Web → Server → Agent Integration Map

Bảng ánh xạ hành động UI → REST API → AI Agent endpoint (nếu có).

## Auth

| UI Action | Web Service | Server Endpoint | Agent |
|-----------|-------------|-----------------|-------|
| Login | `authService.login` | `POST /api/auth/login` | — |
| Register | `authService.register` | `POST /api/auth/register` | — |
| Init app | `authStore.initialize` → `getMe` / `refreshToken` | `GET /api/auth/me`, `POST /api/auth/refresh` | — |
| Update name | `authService.updateName` | `PATCH /api/auth/me/name` | — |
| Logout | `authService.logout` | `POST /api/auth/revoke` | — |

## Classes & Topics

| UI Action | Web Service | Server Endpoint | Agent |
|-----------|-------------|-----------------|-------|
| List teacher classes | `classesService.getClasses` | `GET /api/classes` | — |
| Create class | `classesService.createClass` | `POST /api/classes` | — |
| Join class | `classesService.joinClass` | `POST /api/classes/join` | — |
| List topics | `topicsService.getTopics` | `GET /api/classes/{id}/topics` | — |
| AI evaluate topics | `topicsService.aiEvaluate` | `POST /api/classes/{id}/topics/ai-evaluate` | `AskAsync` ✅ |

## Documents

| UI Action | Web Service | Server Endpoint | Agent |
|-----------|-------------|-----------------|-------|
| Request upload URL | `documentsService.request*UploadUrl` | `POST .../request-upload` | — |
| PUT file | `documentsService.uploadFileToMinio` | MinIO presigned | — |
| Confirm upload | `documentsService.confirm*Upload` | `POST .../confirm` | `POST /rag/ingest` ⚠️ async |
| Retry ingest | re-confirm upload | `POST .../confirm` | `POST /rag/ingest` |
| Generate quiz | `documentsService.generateQuiz*` | `POST .../generate-quiz` | `POST /tutor/generate-quiz` |
| Delete doc | `documentsService.delete*` | `DELETE ...` | `POST /rag/delete` |

## Quizzes & AI Studio

| UI Action | Web Service | Server Endpoint | Agent |
|-----------|-------------|-----------------|-------|
| Get/edit questions | `quizzesService.getQuestions` etc. | `/api/quizzes/{id}/questions` | — |
| Student delete question | `quizzesService.deleteMyQuestion` | `DELETE /api/quizzes/my/{id}/questions/{qId}` | — |
| Publish | `quizzesService.publishQuiz` | `POST /api/quizzes/{id}/publish` | — |
| Generate entry test | `quizzesService.generateEntryTest` | `POST /api/quizzes/generate-entry-test/{classId}` | `POST /tutor/generate-quiz` |
| Placement test | `placementTestService` | `/api/placement-tests/*` | — |
| AI Tutor next action | `quizzesService.getTutorNextAction` | `GET /api/quizzes/tutor/next-action` | — (server `TutorDecisionService`) |
| Generate question | `quizzesService.generateAdaptiveQuestion` | `GET /api/quizzes/tutor/generate-question` | `GET /tutor/generate-question` |
| Submit tutor answer | `quizzesService.submitTutorAnswer` | `POST /api/quizzes/tutor/submit-answer` | — (server `LearningStatesRepository`) |
| Explain | `quizzesService.getTutorExplanation` | `GET /api/quizzes/tutor/explain` | `GET /tutor/explain` |
| Explain error | `quizzesService.getErrorExplanation` | `POST /api/quizzes/tutor/explain-error` | `POST /tutor/explain-error` |

## Quiz Pool

| UI Action | Web Service | Server Endpoint | Agent |
|-----------|-------------|-----------------|-------|
| Generate pool | `poolService.generatePoolQuiz` | `POST /api/pool/generate` | `POST /tutor/generate-quiz` |
| List topics | `poolService.getTopicsInPool` | `GET /api/pool/topics` | — |
| Create class test | `poolService.createTestFromPool` | `POST /api/pool/create-test` | — |
| Create revision set | `poolService.createRevisionSetFromPool` | `POST /api/pool/create-revision-set` | — |
| List revision sets | `apiClient` direct | `GET /api/pool/revision-sets` | — |

## Roadmap & Learning

| UI Action | Web Service | Server Endpoint | Agent |
|-----------|-------------|-----------------|-------|
| Get roadmap | `roadmapService.getRoadmap` | `GET /api/roadmap/{classId}` | — |
| Generate roadmap | `roadmapService.generateRoadmap` | `POST /api/roadmap/{classId}/generate` | — |
| Update step | `roadmapService.updateStep` | `PATCH /api/roadmap/{classId}/steps/{stepId}` | — |
| BKT states | `learningStateService` | `/api/learning-states/*` | — |
| Review schedule | `learningStateService.getReviewSchedule` | `GET /api/learning-states/me/review-schedule` | — |

## Placement & Practice Session

| UI Action | Web Service | Server Endpoint | Agent |
|-----------|-------------|-----------------|-------|
| Placement test | `placementTestService` | `/api/placement-tests/*` | — ✅ PostgreSQL |
| Practice session | `practiceSessionService` | `/api/practice-sessions/*` | — ✅ PostgreSQL |
| Review session | `practiceSessionService.startReview` | `POST /api/practice-sessions/start-review` | — |

## AI Chat

| UI Action | Web Service | Server Endpoint | Agent |
|-----------|-------------|-----------------|-------|
| Ask question | `aiChatService.ask` | `POST /api/ai-chat/ask` | `POST /tutor/chat` |
| History | `aiChatService.getHistory` | `GET /api/ai-chat/history` | — |
| Clear history | `aiChatService.clearHistory` | `DELETE /api/ai-chat/history` | — |

## AgentService → Agent endpoint map

| AgentService method | Agent HTTP |
|---------------------|------------|
| `GenerateQuizQuestionAsync` | `GET /tutor/generate-question` |
| `GetExplanationAsync` | `GET /tutor/explain` |
| `GetGraderExplanationAsync` | `POST /tutor/explain-error` |
| `GenerateQuizBatchAsync` | `POST /tutor/generate-quiz` |
| `AskAsync` | `POST /tutor/chat` |
| `IngestDocumentAsync` | `POST /rag/ingest` |
| `DeleteDocumentAsync` | `POST /rag/delete` |

**Không được .NET gọi:** `/tutor/next-action`, `/tutor/update-state`, `/entry-test/*`, `/spaced-repetition/update`, `/rag/retrieve`.

## Liên kết

- [api-reference.md](api-reference.md)
- [flows/](flows/)
- [../99-known-issues/cross-layer-inconsistencies.md](../99-known-issues/cross-layer-inconsistencies.md)
