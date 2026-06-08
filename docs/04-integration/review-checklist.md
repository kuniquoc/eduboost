# Documentation Review Checklist

Checklist đảm bảo mỗi endpoint có tài liệu cross-reference.

## Endpoint coverage

| Feature | api-reference | server feature doc | flow doc | web service |
|---------|---------------|-------------------|----------|-------------|
| Auth | ✅ | [auth.md](../02-server/features/auth.md) | [01-auth](../04-integration/flows/01-auth-token-rotation.md) | auth.service |
| Classes | ✅ | classes.md | [17-class](../04-integration/flows/17-class-lifecycle.md) | classes.service |
| Topics | ✅ | topics.md | [18-topic](../04-integration/flows/18-topic-ai-evaluate.md) | topics.service |
| Documents | ✅ | documents.md | [02-upload](../04-integration/flows/02-document-upload-rag.md) | documents.service |
| Quizzes | ✅ | quizzes.md | [06-studio](../04-integration/flows/06-ai-studio-publish.md) | quizzes.service |
| Quiz Pool | ✅ | quizpool.md | [04-pool](../04-integration/flows/04-quiz-pool-teacher.md) | pool.service |
| Roadmap | ✅ | roadmap.md | [09-roadmap](../04-integration/flows/09-roadmap.md) | roadmap.service |
| Learning States | ✅ | learningstates.md | [11-bkt](../04-integration/flows/11-bkt-review-schedule.md) | learningState.service |
| Placement | ✅ | placementtests.md | [08-placement](../04-integration/flows/08-placement-test.md) | placementTest.service |
| Practice Sessions | ✅ | practicesessions.md | [12-practice](../04-integration/flows/12-practice-session.md) | practiceSession.service |
| Learning Paths | ✅ | learningpaths.md | [15-paths](../04-integration/flows/15-learning-paths.md) | learningPath.service 🔧 |
| AI Chat | ✅ | aichat.md | [13-chat](../04-integration/flows/13-ai-chat-rag.md) | aiChat.service |
| Students | ✅ | students.md | — | students.service |
| User Profiles | ✅ | userprofiles.md | — | userProfile.service |
| Admin | ✅ | admin.md | [16-admin](../04-integration/flows/16-admin-dashboard.md) | admin.service |

## Agent endpoint coverage

| Agent endpoint | endpoints.md | .NET AgentService | flow |
|----------------|--------------|-------------------|------|
| /tutor/* | ✅ | ✅ | 10, 13 |
| /rag/ingest | ✅ | ✅ | 02 |
| /rag/delete | ✅ | ✅ | 02 |
| /entry-test/* | ✅ | ❌ | — |
| /spaced-repetition/update | ✅ | ❌ | — |

## Khi thêm feature mới

1. Thêm endpoint vào `api-reference.md`
2. Thêm `02-server/features/{name}.md`
3. Thêm `01-web/services/{name}.service.md` nếu có UI
4. Thêm flow trong `04-integration/flows/`
5. Cập nhật `web-server-agent-map.md`
6. Ghi gap vào `99-known-issues/` nếu chưa hoàn thiện

## Deprecated docs

Các file root `docs/*.md` cũ có header DEPRECATED — dùng `04-integration/` và cấu trúc mới.
