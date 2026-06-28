# EF Entities

> Nguồn: [`Infrastructure/Entities/`](../../server/Infrastructure/Persistence/Entities/), [`AppDbContext.cs`](../../server/Infrastructure/Persistence/AppDbContext.cs)

## Bảng (17 entities)

| Entity | Table | Mô tả |
|--------|-------|-------|
| `User` | users | Email unique, role, BCrypt password |
| `RefreshToken` | refresh_tokens | JWT refresh rotation |
| `Class` | classes | Teacher, ClassCode unique |
| `Enrollment` | enrollments | Student↔Class unique pair |
| `Topic` | topics | Class hoặc private owner |
| `Document` | documents | MinIO key, scope class/student |
| `Quiz` | quizzes | Types: entry_test, practice, pool, private |
| `Question` | questions | MCQ, SourceDocumentId optional |
| `QuizOption` | quiz_options | A-D options |
| `QuizSubmission` | quiz_submissions | Student answers |
| `UserProfile` | user_profiles | Level, mastery, streak |
| `LearningSession` | learning_sessions | Practice session summary |
| `PlacementTestResult` | placement_test_results | Adaptive placement |
| `PersonalizedLearningPath` | personalized_learning_paths | Roadmap + learning path |
| `BktState` | bkt_states | Mastery per user+topic |
| `SpacedRepetitionItem` | spaced_repetition_items | SM-2 per question |
| `ConversationMessage` | conversation_messages | AI chat history |

## Migrations

| Migration | Nội dung |
|-----------|----------|
| `20260409000000_InitialCreate` | Core schema |
| `20260523163506_AddQuizPoolFields` | Quiz pool |
| `20260601231426_AddLearningEntities` | BKT, SR, chat, placement, SourceDocumentId |

## Quiz types

| Type | Published | Appendable |
|------|-----------|------------|
| `entry_test` | Yes | No |
| `practice` | Yes | No |
| `pool` | No | Yes |
| `private` | No | No |

## Liên kết

- [data-models.md](../04-integration/data-models.md)
