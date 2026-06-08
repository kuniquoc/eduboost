> **DEPRECATED** — Tài liệu đã chuyển sang [04-integration/data-models.md](04-integration/data-models.md).

# EduBoost — Data Models & Entities

## Entity Relationship Diagram

```
┌──────────┐     ┌──────────────┐     ┌───────────┐
│   User   │1───*│  Enrollment  │*───1│   Class   │
│(teacher/ │     │              │     │           │
│ student) │     └──────────────┘     │           │
│          │                          │           │
│          │1────────────────────────*│           │
│          │  (TaughtClasses)         │           │
└────┬─────┘                          └─────┬─────┘
     │                                      │
     │1                                     │1
     │                                      │
     ├───────*┌──────────┐*─────────────────┤
     │        │ Document │                  │
     │        └────┬─────┘                  │
     │             │                        │
     │             │ GeneratedQuiz?         │1
     │             ▼                        │
     │        ┌──────────┐     ┌──────────┐ │
     │        │   Quiz   │*───1│  Topic   │*┘
     │        └────┬─────┘     └──────────┘
     │             │1
     │             │
     │             ├──────*┌──────────┐
     │             │       │ Question │
     │             │       └────┬─────┘
     │             │            │1
     │             │            │
     │             │            └──*┌────────────┐
     │             │               │  QuizOption │
     │             │               └─────────────┘
     │1            │1
     │             │
     └──────*┌─────┴──────────┐
             │ QuizSubmission │
             └────────────────┘

     ┌──────────┐
     │   User   │1───*┌──────────────┐
     │          │     │ RefreshToken │
     └──────────┘     └──────────────┘
```

---

## Entity Definitions

### User

| Column       | Type     | Constraints            | Mô tả                         |
| ------------ | -------- | ---------------------- | ------------------------------ |
| Id           | Guid     | PK                     |                                |
| Name         | string   | required               |                                |
| Email        | string   | required, unique index |                                |
| PasswordHash | string   | required               | BCrypt hash (cost=11)          |
| Role         | string   | required               | `"teacher"` hoặc `"student"`   |
| AvatarInitials | string |                        | 2 ký tự đầu tên                |
| CreatedAt    | DateTime |                        |                                |

**Relationships**:
- `TaughtClasses`: 1→many `Class` (teacher)
- `Enrollments`: 1→many `Enrollment` (student)
- `Documents`: 1→many `Document`
- `QuizSubmissions`: 1→many `QuizSubmission`
- `RefreshTokens`: 1→many `RefreshToken`

---

### Class

| Column       | Type     | Constraints            | Mô tả                     |
| ------------ | -------- | ---------------------- | -------------------------- |
| Id           | Guid     | PK                     |                            |
| Name         | string   | required               |                            |
| Description  | string   |                        |                            |
| CoverColor   | string   | default: `"#6366F1"`   | Hex color cho card         |
| ClassCode    | string   | required, unique index | Mã tham gia lớp            |
| TeacherId    | Guid     | FK → User              |                            |
| CreatedAt    | DateTime |                        |                            |

**Relationships**:
- `Teacher`: many→1 `User` (OnDelete: Restrict)
- `Enrollments`: 1→many `Enrollment` (Cascade)
- `Topics`: 1→many `Topic` (Cascade)
- `Documents`: 1→many `Document` (SetNull)
- `Quizzes`: 1→many `Quiz` (SetNull)

---

### Enrollment

| Column              | Type     | Constraints                | Mô tả             |
| -------------------- | -------- | -------------------------- | ------------------ |
| Id                   | Guid     | PK                         |                    |
| StudentId            | Guid     | FK → User                  |                    |
| ClassId              | Guid     | FK → Class                 |                    |
| EnrolledAt           | DateTime |                            |                    |
| EntryTestCompleted   | bool     | default: false             |                    |
| Progress             | int      | default: 0                 | 0–100              |

**Unique constraint**: `(StudentId, ClassId)`

**Relationships**:
- `Student`: many→1 `User` (Cascade)
- `Class`: many→1 `Class` (Cascade)

---

### Topic

| Column             | Type     | Constraints        | Mô tả                          |
| ------------------- | -------- | ------------------ | ------------------------------- |
| Id                  | Guid     | PK                 |                                 |
| ClassId             | Guid     | FK → Class         |                                 |
| Name                | string   | required           |                                 |
| Description         | string   |                    |                                 |
| Difficulty          | string   | default: `"medium"`| `"easy"`, `"medium"`, `"hard"`  |
| AiEvaluated         | bool     | default: false     | AI đã đánh giá chưa             |
| IsDocumentVisible   | bool     | default: false     | Học sinh có thể xem docs không  |
| CreatedAt           | DateTime |                    |                                 |

**Relationships**:
- `Class`: many→1 `Class` (Cascade)
- `Quizzes`: 1→many `Quiz` (SetNull)
- `Documents`: 1→many `Document` (SetNull)

---

### Document

| Column          | Type     | Constraints     | Mô tả                              |
| ---------------- | -------- | --------------- | ----------------------------------- |
| Id               | Guid     | PK              |                                     |
| OwnerId          | Guid     | FK → User       |                                     |
| FileName         | string   | required        |                                     |
| FileSize         | string   | required        | VD: "2.5 MB"                        |
| StorageKey       | string   | required        | MinIO object key                    |
| Status           | string   | default: `"pending"` | `"pending"`, `"processing"`, `"ready"`, `"error"` |
| Scope            | string   | default: `"class"` | `"class"` hoặc `"student"`        |
| ClassId          | Guid?    | FK → Class      | null nếu student private doc        |
| TopicId          | Guid?    | FK → Topic      |                                     |
| GeneratedQuizId  | Guid?    | FK → Quiz       | Quiz đã sinh từ doc này             |
| UploadedAt       | DateTime |                 |                                     |

**Relationships**:
- `Owner`: many→1 `User` (Restrict)
- `Class`: many→1 `Class` (SetNull)
- `Topic`: many→1 `Topic` (SetNull)
- `GeneratedQuiz`: many→1 `Quiz` (SetNull)

**MinIO Buckets**:
- `eduboost-class-docs`: Tài liệu lớp
- `eduboost-student-docs`: Tài liệu cá nhân

---

### Quiz

| Column      | Type     | Constraints      | Mô tả                               |
| ------------ | -------- | ---------------- | ------------------------------------ |
| Id           | Guid     | PK               |                                      |
| ClassId      | Guid?    | FK → Class       | null nếu private quiz                |
| TopicId      | Guid?    | FK → Topic       |                                      |
| Title        | string   | required         |                                      |
| Type         | string   | default: `"practice"` | `"entry_test"`, `"practice"`, `"private"` |
| IsPublished  | bool     | default: false   | Teacher đã publish chưa              |
| CreatedAt    | DateTime |                  |                                      |

**Relationships**:
- `Class`: many→1 `Class` (SetNull)
- `Topic`: many→1 `Topic` (SetNull)
- `Questions`: 1→many `Question` (Cascade)
- `GeneratedFromDocuments`: 1→many `Document`
- `Submissions`: 1→many `QuizSubmission` (Cascade)

---

### Question

| Column            | Type     | Constraints | Mô tả                                 |
| ------------------- | -------- | ----------- | -------------------------------------- |
| Id                  | Guid     | PK          |                                        |
| QuizId              | Guid     | FK → Quiz   |                                        |
| Text                | string   | required    | Nội dung câu hỏi                      |
| Type                | string   | default: `"mcq"` | `"mcq"`, `"multi_select"`, `"fill_blank"` |
| Difficulty          | string   | default: `"medium"` | `"easy"`, `"medium"`, `"hard"`   |
| Explanation         | string?  |             | Giải thích đáp án                      |
| CorrectAnswer       | string?  |             | Dùng cho fill_blank                    |
| VerifiedByTeacher   | bool     | default: false | Teacher đã kiểm duyệt chưa          |
| OrderIndex          | int      | default: 0  | Thứ tự hiển thị                        |

**Relationships**:
- `Quiz`: many→1 `Quiz` (Cascade)
- `Options`: 1→many `QuizOption` (Cascade)

---

### QuizOption

| Column     | Type   | Constraints    | Mô tả         |
| ----------- | ------ | -------------- | -------------- |
| Id          | Guid   | PK             |                |
| QuestionId  | Guid   | FK → Question  |                |
| Text        | string | required       | Nội dung lựa chọn |
| IsCorrect   | bool   | default: false |                |
| OrderIndex  | int    | default: 0     |                |

**Relationships**:
- `Question`: many→1 `Question` (Cascade)

---

### QuizSubmission

| Column         | Type     | Constraints  | Mô tả                   |
| --------------- | -------- | ------------ | ------------------------ |
| Id              | Guid     | PK           |                          |
| StudentId       | Guid     | FK → User    |                          |
| QuizId          | Guid     | FK → Quiz    |                          |
| Score           | int      |              | Số câu đúng              |
| TotalQuestions  | int      |              | Tổng số câu              |
| Percentage      | double   |              | Score/Total * 100        |
| Grade           | string   |              | A/B/C/D/F               |
| AnswersJson     | string   |              | JSON serialized answers  |
| CompletedAt     | DateTime |              |                          |

**Relationships**:
- `Student`: many→1 `User` (Restrict)
- `Quiz`: many→1 `Quiz` (Cascade)

---

### RefreshToken

| Column          | Type      | Constraints       | Mô tả                 |
| ---------------- | --------- | ----------------- | ---------------------- |
| Id               | Guid      | PK                |                        |
| UserId           | Guid      | FK → User         |                        |
| Token            | string    | required, unique  | Base64 64-byte token   |
| ExpiresAt        | DateTime  |                   |                        |
| IsRevoked        | bool      | default: false    |                        |
| CreatedAt        | DateTime  |                   |                        |
| ReplacedByToken  | string?   |                   | Token chain tracking   |

**Relationships**:
- `User`: many→1 `User` (Cascade)

---

### UserProfile

| Column              | Type      | Constraints          | Mô tả                          |
| ------------------- | --------- | -------------------- | ------------------------------ |
| Id                  | Guid      | PK                   |                                |
| UserId              | Guid      | FK → User, unique    |                                |
| CurrentLevel        | string    | default: "beginner"  | beginner/intermediate/advanced |
| OverallMasteryScore | double    | default: 0.0         |                                |
| PreferredTopics     | string?   |                      | JSON array of topic IDs        |
| LearningStreak      | int       | default: 0           | Số ngày liên tục              |
| LastActiveDate      | DateTime? |                      |                                |
| CreatedAt           | DateTime  |                      |                                |
| UpdatedAt           | DateTime  |                      |                                |

**Relationships**:
- `User`: 1:1 `User` (Cascade)

---

### LearningSession

| Column             | Type      | Constraints    | Mô tả              |
| ------------------ | --------- | -------------- | ------------------- |
| Id                 | Guid      | PK             |                     |
| UserId             | Guid      | FK → User      |                     |
| TopicId            | Guid      | FK → Topic     |                     |
| StartTime          | DateTime  |                |                     |
| EndTime            | DateTime? |                |                     |
| QuestionsAttempted | int       |                |                     |
| CorrectAnswers     | int       |                |                     |
| Score              | double    |                | Phần trăm đúng     |

**Relationships**:
- `User`: many→1 `User` (Cascade)
- `Topic`: many→1 `Topic` (Cascade)

---

### PlacementTestResult

| Column         | Type     | Constraints       | Mô tả                     |
| -------------- | -------- | ----------------- | -------------------------- |
| Id             | Guid     | PK                |                            |
| UserId         | Guid     | FK → User         |                            |
| InitialLevel   | string   | default: beginner | Kết quả xếp loại         |
| FinalScore     | double   |                   | Điểm phần trăm           |
| StrengthsJson  | string?  |                   | JSON: topic scores mạnh   |
| WeaknessesJson | string?  |                   | JSON: topic scores yếu    |
| CreatedAt      | DateTime |                   |                            |

**Relationships**:
- `User`: many→1 `User` (Cascade)

---

### PersonalizedLearningPath

| Column                | Type      | Constraints               | Mô tả                    |
| --------------------- | --------- | ------------------------- | ------------------------- |
| Id                    | Guid      | PK                        |                           |
| UserId                | Guid      | FK → User                 |                           |
| TopicId               | Guid      | FK → Topic                |                           |
| RecommendedDifficulty | string    | default: "medium"         | easy/medium/hard          |
| PriorityScore         | double    |                           | Ưu tiên học              |
| NextReviewDate        | DateTime? |                           | Lịch ôn tập tiếp theo   |
| IsCompleted           | bool      | default: false            |                           |
| OrderIndex            | int       |                           | Thứ tự trong lộ trình    |
| CreatedAt             | DateTime  |                           |                           |
| UpdatedAt             | DateTime  |                           |                           |

**Relationships**:
- `User`: many→1 `User` (Cascade)
- `Topic`: many→1 `Topic` (Cascade)
- Unique constraint: (UserId, TopicId)

---

### BktState

| Column                | Type     | Constraints               | Mô tả                        |
| --------------------- | -------- | ------------------------- | ----------------------------- |
| Id                    | Guid     | PK                        |                               |
| UserId                | Guid     | FK → User                 |                               |
| TopicId               | Guid     | FK → Topic                |                               |
| MasteryProbability    | double   | default: 0.3              | P(L) - xác suất thành thạo   |
| GuessProbability      | double   | default: 0.25             | P(G) - xác suất đoán đúng    |
| SlipProbability       | double   | default: 0.1              | P(S) - xác suất nhầm         |
| TransitionProbability | double   | default: 0.1              | P(T) - xác suất chuyển đổi   |
| IrtTheta              | double   | default: 0.0              | Năng lực IRT                  |
| UpdatedAt             | DateTime |                           |                               |

**Relationships**:
- `User`: many→1 `User` (Cascade)
- `Topic`: many→1 `Topic` (Cascade)
- Unique constraint: (UserId, TopicId)

---

### SpacedRepetitionItem

| Column          | Type     | Constraints                  | Mô tả                     |
| --------------- | -------- | ---------------------------- | -------------------------- |
| Id              | Guid     | PK                           |                            |
| UserId          | Guid     | FK → User                    |                            |
| QuestionId      | Guid     | FK → Question                |                            |
| TopicId         | Guid     | FK → Topic                   |                            |
| LastReviewDate  | DateTime |                              | Lần ôn cuối               |
| NextReviewDate  | DateTime | indexed                      | Lần ôn tiếp theo          |
| ReviewInterval  | double   | default: 1.0                 | Khoảng cách ôn (ngày)     |
| EaseFactor      | double   | default: 2.5                 | SM-2 ease factor           |
| RetentionScore  | double   | default: 0.0                 | Mức nhớ                   |
| RepetitionCount | int      |                              | Số lần ôn liên tiếp đúng  |

**Relationships**:
- `User`: many→1 `User` (Cascade)
- `Question`: many→1 `Question` (Cascade)
- `Topic`: many→1 `Topic` (Restrict)
- Unique constraint: (UserId, QuestionId)

---

### ConversationMessage

| Column               | Type      | Constraints    | Mô tả                        |
| -------------------- | --------- | -------------- | ----------------------------- |
| Id                   | Guid      | PK             |                               |
| UserId               | Guid      | FK → User      |                               |
| TopicId              | Guid?     | FK → Topic     |                               |
| Role                 | string    | default: "user"| "user" hoặc "assistant"       |
| Content              | string    | required       | Nội dung tin nhắn             |
| SourceReferencesJson | string?   |                | JSON: tài liệu tham chiếu    |
| CreatedAt            | DateTime  |                |                               |

**Relationships**:
- `User`: many→1 `User` (Cascade)
- `Topic`: many→1 `Topic` (SetNull)
- Composite index: (UserId, TopicId, CreatedAt)

---

## Enums & Constants

### User Roles

| Value     | Mô tả         |
| --------- | ------------- |
| `teacher` | Giáo viên     |
| `student` | Học sinh      |
| `admin`   | Quản trị viên |

### Question Types

| Value          | Mô tả                     |
| -------------- | -------------------------- |
| `mcq`          | Multiple Choice (1 đáp án) |
| `multi_select` | Multi Select (nhiều đáp án) |
| `fill_blank`   | Điền vào chỗ trống          |

### Difficulty Levels

| Value    | Mô tả |
| -------- | ----- |
| `easy`   | Dễ    |
| `medium` | Trung bình |
| `hard`   | Khó   |

### Document Status

| Value        | Mô tả                            |
| ------------ | --------------------------------- |
| `pending`    | Vừa tạo record, chưa upload      |
| `processing` | Đang xử lý                       |
| `ready`      | Upload hoàn tất, sẵn sàng dùng   |
| `error`      | Lỗi upload/xử lý                 |

### Document Scope

| Value     | Mô tả              |
| --------- | ------------------- |
| `class`   | Tài liệu lớp học    |
| `student` | Tài liệu cá nhân    |

### Quiz Type

| Value        | Mô tả                            |
| ------------ | --------------------------------- |
| `entry_test` | Bài test đầu vào                  |
| `practice`   | Bài luyện tập                     |
| `private`    | Quiz cá nhân (student tự tạo)     |

### Roadmap Step Status

| Value         | Mô tả                                  |
| ------------- | --------------------------------------- |
| `completed`   | Đã hoàn thành                           |
| `in_progress` | Đang thực hiện                          |
| `recommended` | AI đề xuất nên làm tiếp                 |
| `locked`      | Chưa mở khóa (cần hoàn thành bước trước)|

### Grade Scale

| Grade | Percentage  |
| ----- | ----------- |
| A     | ≥ 90%       |
| B     | ≥ 80%       |
| C     | ≥ 70%       |
| D     | ≥ 60%       |
| F     | < 60%       |

---

## Database Configuration

- **Engine**: PostgreSQL 16 Alpine
- **Table naming**: snake_case (`users`, `classes`, `enrollments`, ...)
- **Primary keys**: Guid (UUID)
- **Timestamps**: DateTime (UTC)
- **JSON storage**: `AnswersJson` trong `QuizSubmission` lưu dưới dạng string
