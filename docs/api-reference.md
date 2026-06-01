# EduBoost — API Reference

Tất cả endpoints trả về response wrapper:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "errors": null
}
```

**Base URL**: `http://localhost:5000/api`

**Authentication**: JWT Bearer token trong header `Authorization: Bearer <access_token>`

---

## Auth

### POST `/api/auth/login`

Đăng nhập, trả về access + refresh tokens.

**Auth**: None

**Request Body**:

```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response** `200`: `ApiResponse<AuthTokensDto>`

```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "user": {
    "userId": "guid",
    "name": "string",
    "email": "string",
    "role": "teacher | student",
    "avatar": "string?"
  }
}
```

---

### POST `/api/auth/register`

Tạo tài khoản mới.

**Auth**: None

**Request Body**:

```json
{
  "name": "string (required)",
  "email": "string (required, email format)",
  "password": "string (required, min 6 chars)",
  "role": "string (required, default: 'student')"
}
```

**Response** `201`: `ApiResponse<AuthTokensDto>` (cấu trúc giống login)

---

### POST `/api/auth/refresh`

Refresh access token (token rotation — old refresh token bị revoke).

**Auth**: None

**Request Body**:

```json
{
  "refreshToken": "string (required)"
}
```

**Response** `200`: `ApiResponse<AuthTokensDto>`

---

### POST `/api/auth/revoke`

Logout — revoke refresh token.

**Auth**: `[Authorize]`

**Request Body**:

```json
{
  "refreshToken": "string (required)"
}
```

**Response** `200`: `ApiResponse`

---

### GET `/api/auth/me`

Lấy thông tin user hiện tại.

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<UserDto>`

```json
{
  "userId": "guid",
  "name": "string",
  "email": "string",
  "role": "teacher | student",
  "avatar": "string?"
}
```

---

## Classes

### GET `/api/classes`

Lấy danh sách lớp của teacher.

**Auth**: `[Authorize]` (teacher)

**Response** `200`: `ApiResponse<List<ClassDto>>`

```json
[
  {
    "id": "guid",
    "name": "string",
    "description": "string",
    "coverColor": "string (default: #6366F1)",
    "studentCount": 0,
    "averageProgress": 0,
    "topicCount": 0,
    "classCode": "string",
    "createdAt": "ISO 8601",
    "teacherId": "guid"
  }
]
```

---

### POST `/api/classes`

Tạo lớp mới.

**Auth**: `[Authorize]` (teacher)

**Request Body**:

```json
{
  "name": "string (required, min 3 chars)",
  "description": "string",
  "coverColor": "string (default: #6366F1)"
}
```

**Response** `201`: `ApiResponse<ClassDto>`

---

### GET `/api/classes/{id}`

Chi tiết lớp kèm danh sách topics.

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<ClassDetailDto>`

```json
{
  "id": "guid",
  "name": "string",
  "description": "string",
  "coverColor": "string",
  "studentCount": 0,
  "averageProgress": 0,
  "topicCount": 0,
  "classCode": "string",
  "createdAt": "ISO 8601",
  "teacherId": "guid",
  "topics": [
    {
      "id": "guid",
      "name": "string",
      "difficulty": "easy | medium | hard",
      "aiEvaluated": false,
      "questionCount": 0,
      "isDocumentVisible": false
    }
  ]
}
```

---

### PUT `/api/classes/{id}`

Cập nhật thông tin lớp.

**Auth**: `[Authorize]` (teacher, owner)

**Request Body**:

```json
{
  "name": "string?",
  "description": "string?",
  "coverColor": "string?"
}
```

**Response** `200`: `ApiResponse<ClassDto>`

---

### DELETE `/api/classes/{id}`

Xóa lớp.

**Auth**: `[Authorize]` (teacher, owner)

**Response** `200`: `ApiResponse`

---

### GET `/api/classes/{id}/students?search=`

Danh sách học sinh trong lớp.

**Auth**: `[Authorize]` (teacher, owner)

**Query**: `search` (string, optional) — tìm theo tên/email

**Response** `200`: `ApiResponse<List<StudentEnrollmentDto>>`

```json
[
  {
    "userId": "guid",
    "name": "string",
    "email": "string",
    "avatar": "string?",
    "joinedAt": "ISO 8601",
    "entryTestCompleted": false,
    "completionPercent": 0
  }
]
```

---

### POST `/api/classes/{id}/students`

Thêm học sinh vào lớp bằng email.

**Auth**: `[Authorize]` (teacher, owner)

**Request Body**:

```json
{
  "studentEmail": "string (required, email format)"
}
```

**Response** `200`: `ApiResponse`

---

### DELETE `/api/classes/{id}/students/{studentId}`

Xóa học sinh khỏi lớp.

**Auth**: `[Authorize]` (teacher, owner)

**Response** `200`: `ApiResponse`

---

### GET `/api/classes/enrolled`

Lấy danh sách lớp đã tham gia (student).

**Auth**: `[Authorize]` (student)

**Response** `200`: `ApiResponse<List<ClassDto>>`

---

### POST `/api/classes/join`

Tham gia lớp bằng mã code.

**Auth**: `[Authorize]` (student)

**Request Body**:

```json
{
  "classCode": "string (required)"
}
```

**Response** `200`: `ApiResponse<ClassDto>`

---

## Topics

### GET `/api/classes/{classId}/topics`

Danh sách topics trong lớp.

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<List<TopicDto>>`

```json
[
  {
    "id": "guid",
    "classId": "guid",
    "name": "string",
    "description": "string",
    "difficulty": "easy | medium | hard",
    "aiEvaluated": false,
    "questionCount": 0,
    "isDocumentVisible": false,
    "createdAt": "ISO 8601"
  }
]
```

---

### POST `/api/classes/{classId}/topics`

Tạo topic mới.

**Auth**: `[Authorize]` (teacher)

**Request Body**:

```json
{
  "name": "string (required, min 2 chars)",
  "description": "string"
}
```

**Response** `201`: `ApiResponse<TopicDto>`

---

### PUT `/api/classes/{classId}/topics/{id}`

Cập nhật topic.

**Auth**: `[Authorize]` (teacher)

**Request Body**:

```json
{
  "name": "string?",
  "description": "string?"
}
```

**Response** `200`: `ApiResponse<TopicDto>`

---

### DELETE `/api/classes/{classId}/topics/{id}`

Xóa topic.

**Auth**: `[Authorize]` (teacher)

**Response** `200`: `ApiResponse`

---

### POST `/api/classes/{classId}/topics/ai-evaluate`

AI đánh giá độ khó cho tất cả topics trong lớp.

**Auth**: `[Authorize]` (teacher)

**Response** `200`: `ApiResponse<List<TopicDto>>`

---

### PUT `/api/classes/{classId}/topics/{id}/difficulty`

Cập nhật độ khó thủ công.

**Auth**: `[Authorize]` (teacher)

**Request Body**:

```json
{
  "difficulty": "string (required: easy | medium | hard)"
}
```

**Response** `200`: `ApiResponse<TopicDto>`

---

### PATCH `/api/classes/{classId}/topics/{id}/visibility`

Toggle hiển thị document cho học sinh.

**Auth**: `[Authorize]` (teacher)

**Request Body**:

```json
{
  "isDocumentVisible": true
}
```

**Response** `200`: `ApiResponse<TopicDto>`

---

## Documents

### Class Documents (Teacher)

#### GET `/api/classes/{classId}/documents`

Danh sách documents trong lớp.

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<List<DocumentDto>>`

```json
[
  {
    "id": "guid",
    "ownerId": "guid",
    "name": "string",
    "size": "string",
    "status": "pending | uploading | processing | ready | error",
    "uploadedAt": "ISO 8601",
    "topicId": "guid?",
    "generatedQuizId": "guid?",
    "classId": "guid?",
    "scope": "class | student"
  }
]
```

---

#### POST `/api/classes/{classId}/documents/request-upload`

Yêu cầu presigned URL để upload file trực tiếp lên MinIO.

**Auth**: `[Authorize]` (teacher)

**Request Body**:

```json
{
  "fileName": "string (required)",
  "fileSize": "string (required)",
  "topicId": "guid? (optional)"
}
```

**Response** `200`: `ApiResponse<UploadUrlDto>`

```json
{
  "documentId": "guid",
  "uploadUrl": "presigned PUT URL",
  "expiresInSeconds": 600
}
```

---

#### POST `/api/classes/{classId}/documents/confirm`

Xác nhận upload hoàn tất → status chuyển sang "ready".

**Auth**: `[Authorize]` (teacher)

**Request Body**:

```json
{
  "documentId": "guid (required)"
}
```

**Response** `200`: `ApiResponse<DocumentDto>`

---

#### GET `/api/classes/{classId}/documents/{id}/download`

Lấy presigned download URL.

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<DownloadUrlDto>`

```json
{
  "downloadUrl": "presigned GET URL",
  "expiresInSeconds": 3600
}
```

---

#### DELETE `/api/classes/{classId}/documents/{id}`

Xóa document.

**Auth**: `[Authorize]` (teacher)

**Response** `200`: `ApiResponse`

---

#### POST `/api/classes/{classId}/documents/{id}/generate-quiz`

AI sinh quiz từ document.

**Auth**: `[Authorize]` (teacher)

**Request Body**:

```json
{
  "topicId": "guid? (optional)"
}
```

**Response** `200`: `ApiResponse<GenerateQuizJobDto>`

```json
{
  "jobId": "guid",
  "status": "processing",
  "quizId": "guid?",
  "message": "string"
}
```

---

### Student Private Documents

#### GET `/api/documents/my`

Danh sách documents cá nhân.

**Auth**: `[Authorize]` (student)

**Response** `200`: `ApiResponse<List<DocumentDto>>`

---

#### POST `/api/documents/my/request-upload`

Yêu cầu upload URL cho document cá nhân.

**Auth**: `[Authorize]` (student)

**Request Body**: Giống `RequestUploadUrlRequest`

**Response** `200`: `ApiResponse<UploadUrlDto>`

---

#### POST `/api/documents/my/confirm`

Xác nhận upload document cá nhân.

**Auth**: `[Authorize]` (student)

**Request Body**: `{ "documentId": "guid" }`

**Response** `200`: `ApiResponse<DocumentDto>`

---

#### GET `/api/documents/my/{id}/download`

Download document cá nhân.

**Auth**: `[Authorize]` (student)

**Response** `200`: `ApiResponse<DownloadUrlDto>`

---

#### POST `/api/documents/my/{id}/generate-quiz`

AI sinh quiz từ document cá nhân.

**Auth**: `[Authorize]` (student)

**Response** `200`: `ApiResponse<GenerateQuizJobDto>`

---

#### DELETE `/api/documents/my/{id}`

Xóa document cá nhân.

**Auth**: `[Authorize]` (student)

**Response** `200`: `ApiResponse`

---

## Quizzes

### Teacher Quiz Management

#### GET `/api/quizzes/{quizId}/questions`

Lấy danh sách câu hỏi trong quiz.

**Auth**: `[Authorize]` (teacher)

**Response** `200`: `ApiResponse<List<QuestionDto>>`

```json
[
  {
    "id": "guid",
    "quizId": "guid",
    "topicId": "guid",
    "text": "string",
    "type": "mcq | multi_select | fill_blank",
    "difficulty": "easy | medium | hard",
    "options": [
      { "id": "guid", "text": "string", "isCorrect": false }
    ],
    "correctAnswer": "string?",
    "explanation": "string?",
    "verifiedByTeacher": false,
    "orderIndex": 0
  }
]
```

---

#### PUT `/api/quizzes/{quizId}/questions/{qId}`

Chỉnh sửa câu hỏi.

**Auth**: `[Authorize]` (teacher)

**Request Body**:

```json
{
  "text": "string?",
  "options": [{ "id": "guid", "text": "string", "isCorrect": false }],
  "correctAnswer": "string?",
  "explanation": "string?"
}
```

**Response** `200`: `ApiResponse<QuestionDto>`

---

## User Profiles

### GET `/api/user-profiles/me`

Lấy profile người dùng hiện tại (tự động tạo nếu chưa có).

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<UserProfileDto>`

```json
{
  "userId": "guid",
  "currentLevel": "beginner | intermediate | advanced",
  "overallMasteryScore": 0.0,
  "preferredTopics": ["topic-id-1", "topic-id-2"],
  "learningStreak": 5,
  "lastActiveDate": "2024-01-15"
}
```

---

### PUT `/api/user-profiles/me`

Cập nhật profile (preferences).

**Auth**: `[Authorize]`

**Request Body**:

```json
{
  "currentLevel": "string?",
  "preferredTopics": ["string"]?
}
```

**Response** `200`: `ApiResponse<UserProfileDto>`

---

### GET `/api/user-profiles/{userId}`

Admin/GV xem profile học sinh.

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<UserProfileDto>`

---

## Learning States (BKT + Spaced Repetition)

### GET `/api/learning-states/me`

Lấy toàn bộ BKT state của học sinh hiện tại.

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<List<BktStateDto>>`

```json
[
  {
    "topicId": "guid",
    "topicName": "Present Simple",
    "masteryProbability": 0.72,
    "guessProbability": 0.25,
    "slipProbability": 0.1,
    "transitionProbability": 0.1,
    "irtTheta": 0.5,
    "updatedAt": "2024-01-15 10:30:00"
  }
]
```

---

### GET `/api/learning-states/me/topic/{topicId}`

Lấy BKT state theo topic.

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<BktStateDto>`

---

### POST `/api/learning-states/update`

Cập nhật BKT sau câu trả lời.

**Auth**: `[Authorize]`

**Request Body**:

```json
{
  "topicId": "guid (required)",
  "questionId": "guid (required)",
  "isCorrect": true,
  "responseTime": 5.2
}
```

**Response** `200`: `ApiResponse<UpdateBktResponse>`

```json
{
  "state": { "/* BktStateDto */" : "" },
  "recommendation": "Bạn đã thành thạo chủ đề này!"
}
```

---

### GET `/api/learning-states/me/review-schedule`

Lấy danh sách nội dung cần ôn tập hôm nay.

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<ReviewScheduleDto>`

```json
{
  "totalDueToday": 5,
  "items": [
    {
      "questionId": "guid",
      "topicId": "guid",
      "topicName": "Past Tense",
      "nextReviewDate": "2024-01-15",
      "retentionScore": 0.6,
      "repetitionCount": 3
    }
  ]
}
```

---

## Placement Tests (Kiểm tra đầu vào thích ứng)

### POST `/api/placement-tests/start`

Bắt đầu bài kiểm tra đầu vào (adaptive).

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<StartPlacementTestResponse>`

```json
{
  "sessionId": "string",
  "question": {
    "questionId": "guid",
    "text": "Which is correct?",
    "type": "mcq",
    "difficulty": "medium",
    "options": [{ "id": "guid", "text": "Option A" }]
  },
  "questionNumber": 1,
  "totalQuestions": 20
}
```

---

### POST `/api/placement-tests/answer`

Gửi câu trả lời, nhận câu tiếp theo (adaptive difficulty).

**Auth**: `[Authorize]`

**Request Body**:

```json
{
  "sessionId": "string (required)",
  "questionId": "guid (required)",
  "selectedOptionId": "guid?",
  "textAnswer": "string?"
}
```

**Response** `200`: `ApiResponse<AnswerPlacementResponse>`

```json
{
  "isCorrect": true,
  "isComplete": false,
  "nextQuestion": { "questionId": "guid", "text": "...", "type": "mcq", "difficulty": "hard", "options": [] },
  "questionNumber": 5,
  "totalQuestions": 20
}
```

---

### POST `/api/placement-tests/complete`

Kết thúc → tính toán level → khởi tạo BKT + learning path.

**Auth**: `[Authorize]`

**Request Body**:

```json
{
  "sessionId": "string (required)"
}
```

**Response** `200`: `ApiResponse<CompletePlacementResponse>`

```json
{
  "resultId": "guid",
  "initialLevel": "intermediate",
  "finalScore": 72.5,
  "strengths": [{ "topicId": "guid", "topicName": "Present Tense", "score": 0.9 }],
  "weaknesses": [{ "topicId": "guid", "topicName": "Conditionals", "score": 0.3 }]
}
```

---

### GET `/api/placement-tests/result`

Xem kết quả kiểm tra đầu vào gần nhất.

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<PlacementTestResultDto>`

---

## Learning Paths (Lộ trình cá nhân hóa)

### GET `/api/learning-paths/me`

Lấy lộ trình hiện tại của học sinh.

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<LearningPathDto>`

```json
{
  "items": [
    {
      "id": "guid",
      "topicId": "guid",
      "topicName": "Present Simple",
      "recommendedDifficulty": "easy",
      "priorityScore": 0.8,
      "nextReviewDate": "2024-01-16",
      "isCompleted": false,
      "orderIndex": 0
    }
  ],
  "totalItems": 10,
  "completedItems": 3,
  "overallProgress": 30.0
}
```

---

### POST `/api/learning-paths/regenerate`

Tái sinh lộ trình (dựa trên BKT state hiện tại).

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<LearningPathDto>`

---

### PUT `/api/learning-paths/{id}/complete`

Đánh dấu hoàn thành một topic trong lộ trình.

**Auth**: `[Authorize]`

**Response** `200`: `ApiResponse<LearningPathItemDto>`

---

## Practice Sessions (Phiên luyện tập)

### POST `/api/practice-sessions/start`

Bắt đầu phiên luyện tập.

**Auth**: `[Authorize]`

**Request Body**:

```json
{
  "topicId": "guid (required)",
  "questionCount": 10
}
```

**Response** `200`: `ApiResponse<StartPracticeResponse>`

```json
{
  "sessionId": "string",
  "topicName": "Present Simple",
  "question": { "questionId": "guid", "text": "...", "type": "mcq", "difficulty": "medium", "options": [] },
  "questionNumber": 1,
  "totalQuestions": 10
}
```

---

### POST `/api/practice-sessions/answer`

Gửi câu trả lời → cập nhật BKT + SR → trả phản hồi + câu tiếp.

**Auth**: `[Authorize]`

**Request Body**:

```json
{
  "sessionId": "string (required)",
  "questionId": "guid (required)",
  "selectedOptionId": "guid?",
  "textAnswer": "string?"
}
```

**Response** `200`: `ApiResponse<SubmitAnswerResponse>`

```json
{
  "isCorrect": true,
  "correctAnswer": "went",
  "explanation": "Past tense of 'go' is 'went'.",
  "nextQuestion": null,
  "questionNumber": 5,
  "isSessionComplete": false
}
```

---

### POST `/api/practice-sessions/end`

Kết thúc phiên → cập nhật LearningSession + tiến trình.

**Auth**: `[Authorize]`

**Request Body**:

```json
{
  "sessionId": "string (required)"
}
```

**Response** `200`: `ApiResponse<PracticeSessionSummary>`

```json
{
  "sessionId": "string",
  "topicName": "Present Simple",
  "questionsAttempted": 10,
  "correctAnswers": 7,
  "score": 70.0,
  "recommendation": "Xuất sắc! Bạn có thể chuyển sang chủ đề khó hơn."
}
```

---

## AI Chat (Hỏi đáp AI)

### POST `/api/ai-chat/ask`

Gửi câu hỏi → AI trả lời (có RAG context + source references).

**Auth**: `[Authorize]`

**Request Body**:

```json
{
  "question": "string (required)",
  "topicId": "guid?"
}
```

**Response** `200`: `ApiResponse<AskResponse>`

```json
{
  "answer": "Present Simple dùng để diễn tả...",
  "sources": [
    {
      "documentId": "guid",
      "fileName": "grammar.pdf",
      "snippet": "The Present Simple tense..."
    }
  ],
  "messageId": "guid"
}
```

---

### GET `/api/ai-chat/history`

Lấy lịch sử hội thoại.

**Auth**: `[Authorize]`

**Query params**: `topicId` (optional), `page` (default 1), `pageSize` (default 20)

**Response** `200`: `ApiResponse<ChatHistoryDto>`

```json
{
  "total": 25,
  "messages": [
    {
      "id": "guid",
      "role": "user | assistant",
      "content": "string",
      "sources": [],
      "createdAt": "2024-01-15 10:30:00"
    }
  ]
}
```

---

## Admin

### GET `/api/admin/users`

Danh sách tài khoản.

**Auth**: `[Authorize(Roles = "admin")]`

**Query params**: `search` (optional), `role` (optional)

**Response** `200`: `ApiResponse<List<AdminUserDto>>`

```json
[
  {
    "id": "guid",
    "name": "Nguyen Van A",
    "email": "a@example.com",
    "role": "student",
    "createdAt": "2024-01-01 00:00:00"
  }
]
```

---

### PUT `/api/admin/users/{id}/role`

Thay đổi role.

**Auth**: `[Authorize(Roles = "admin")]`

**Request Body**:

```json
{
  "role": "teacher | student | admin"
}
```

**Response** `200`: `ApiResponse`

---

### DELETE `/api/admin/users/{id}`

Vô hiệu hóa/xóa tài khoản.

**Auth**: `[Authorize(Roles = "admin")]`

**Response** `200`: `ApiResponse`

---

### GET `/api/admin/stats`

Thống kê hệ thống.

**Auth**: `[Authorize(Roles = "admin")]`

**Response** `200`: `ApiResponse<SystemStatsDto>`

```json
{
  "totalUsers": 150,
  "totalStudents": 120,
  "totalTeachers": 25,
  "totalClasses": 10,
  "totalTopics": 50,
  "totalQuestions": 500,
  "totalLearningSessions": 1200
}
```

#### DELETE `/api/quizzes/{quizId}/questions/{qId}`

Xóa câu hỏi.

**Auth**: `[Authorize]` (teacher)

**Response** `200`: `ApiResponse`

---

#### PATCH `/api/quizzes/{quizId}/questions/{qId}/verify`

Đánh dấu đã kiểm duyệt.

**Auth**: `[Authorize]` (teacher)

**Request Body**:

```json
{
  "verified": true
}
```

**Response** `200`: `ApiResponse<QuestionDto>`

---

#### POST `/api/quizzes/{quizId}/publish`

Publish quiz ra lớp.

**Auth**: `[Authorize]` (teacher)

**Response** `200`: `ApiResponse`

---

### Student Quiz Operations

#### GET `/api/quizzes/entry-test/{classId}`

Lấy entry test của lớp.

**Auth**: `[Authorize]` (student)

**Response** `200`: `ApiResponse<EntryTestDto>`

```json
{
  "quizId": "guid",
  "classId": "guid",
  "className": "string",
  "questions": [ QuestionDto... ]
}
```

---

#### POST `/api/quizzes/entry-test/{classId}/submit`

Nộp bài entry test.

**Auth**: `[Authorize]` (student)

**Request Body**:

```json
{
  "answers": [
    {
      "questionId": "guid",
      "selectedOptionIds": ["guid"],
      "fillBlankValue": "string?",
      "timeSpentSeconds": 0
    }
  ]
}
```

**Response** `200`: `ApiResponse<QuizResultDto>`

```json
{
  "quizId": "guid",
  "score": 8,
  "total": 10,
  "percentage": 80.0,
  "grade": "A",
  "topicScores": [
    {
      "topicId": "guid",
      "topicName": "string",
      "score": 3,
      "total": 4,
      "percentage": 75.0
    }
  ],
  "completedAt": "ISO 8601"
}
```

---

#### GET `/api/quizzes/practice/{topicId}?limit=10`

Lấy practice quiz cho topic.

**Auth**: `[Authorize]` (student)

**Query**: `limit` (int, default: 10)

**Response** `200`: `ApiResponse<EntryTestDto>` (cùng cấu trúc)

---

#### POST `/api/quizzes/practice/{topicId}/submit`

Nộp bài practice.

**Auth**: `[Authorize]` (student)

**Request Body**: Giống `SubmitQuizRequest`

**Response** `200`: `ApiResponse<QuizResultDto>`

---

#### GET `/api/quizzes/my/{quizId}/questions`

Xem quiz cá nhân.

**Auth**: `[Authorize]` (student)

**Response** `200`: `ApiResponse<List<QuestionDto>>`

---

#### PUT `/api/quizzes/my/{quizId}/questions/{qId}`

Chỉnh sửa câu hỏi quiz cá nhân.

**Auth**: `[Authorize]` (student)

**Request Body**: Giống `UpdateQuestionRequest`

**Response** `200`: `ApiResponse<QuestionDto>`

---

## Students & Analytics

### GET `/api/classes/{classId}/analytics`

Analytics tổng quan của lớp.

**Auth**: `[Authorize]` (teacher)

**Response** `200`: `ApiResponse<ClassAnalyticsDto>`

```json
{
  "classId": "guid",
  "totalStudents": 0,
  "avgCompletion": 0,
  "needAttentionCount": 0,
  "students": [
    {
      "studentId": "guid",
      "studentName": "string",
      "email": "string",
      "avatar": "string?",
      "completionPercent": 0,
      "quizzesTaken": 0,
      "averageScore": 0,
      "weakSkills": [{ "topicId": "guid", "topicName": "string", "score": 0 }],
      "lastActive": "ISO 8601",
      "entryTestCompleted": false
    }
  ]
}
```

---

### GET `/api/classes/{classId}/students/{studentId}/analytics`

Analytics chi tiết 1 học sinh.

**Auth**: `[Authorize]` (teacher)

**Response** `200`: `ApiResponse<StudentAnalyticsDto>`

---

### GET `/api/students/me/progress`

Tiến độ học tập cá nhân.

**Auth**: `[Authorize]` (student)

**Response** `200`: `ApiResponse<StudentProgressDto>`

```json
{
  "studentId": "guid",
  "overallProgress": 0,
  "enrolledClasses": [
    {
      "classId": "guid",
      "className": "string",
      "coverColor": "string",
      "progress": 0,
      "entryTestCompleted": false,
      "joinedAt": "ISO 8601"
    }
  ]
}
```

---

### GET `/api/students/me/stats`

Thống kê cá nhân.

**Auth**: `[Authorize]` (student)

**Response** `200`: `ApiResponse<StudentStatsDto>`

```json
{
  "dayStreak": 0,
  "avgQuizScore": 0,
  "totalQuizzesTaken": 0,
  "weeklyProgress": 0
}
```

---

## Roadmap

### GET `/api/roadmap/{classId}`

Lấy roadmap hiện tại.

**Auth**: `[Authorize]` (student)

**Response** `200`: `ApiResponse<RoadmapDto>`

```json
{
  "classId": "guid",
  "studentId": "guid",
  "generatedAt": "ISO 8601",
  "steps": [
    {
      "id": "string",
      "topicId": "guid",
      "topicName": "string",
      "status": "completed | in_progress | recommended | locked",
      "progress": 0,
      "reason": "string?",
      "orderIndex": 0
    }
  ]
}
```

---

### POST `/api/roadmap/{classId}/generate`

AI sinh roadmap dựa trên kết quả entry test.

**Auth**: `[Authorize]` (student)

**Request Body**:

```json
{
  "entryTestResultId": "guid (required)"
}
```

**Response** `200`: `ApiResponse<RoadmapDto>`

---

### PATCH `/api/roadmap/{classId}/steps/{stepId}`

Cập nhật tiến độ bước trong roadmap.

**Auth**: `[Authorize]` (student)

**Request Body**:

```json
{
  "progress": 0,
  "status": "completed | in_progress | recommended | locked"
}
```

**Response** `200`: `ApiResponse<RoadmapStepDto>`

---

## Other Endpoints

### GET `/health`

Health check (Docker).

**Response** `200`: `{ "status": "Healthy" }`

### GET `/`

Redirect to Swagger UI (`/swagger`).

---

## Error Handling

Tất cả lỗi trả về cùng format `ApiResponse`:

```json
{
  "success": false,
  "data": null,
  "message": "Error description",
  "errors": { ... }
}
```

| Status Code | Ý nghĩa                  |
| ----------- | ------------------------- |
| 200         | Success                   |
| 201         | Created                   |
| 400         | Validation / Bad Request  |
| 401         | Unauthorized (no/bad JWT) |
| 404         | Not Found                 |
| 500         | Internal Server Error     |

## Authentication Flow

1. **Login/Register** → nhận `accessToken` + `refreshToken`
2. **Mỗi request** → gửi `Authorization: Bearer <accessToken>`
3. **Access token hết hạn (60 phút)** → client gọi `/api/auth/refresh` với `refreshToken`
4. **Refresh token rotation**: old token bị revoke, trả về cặp token mới
5. **Logout** → gọi `/api/auth/revoke` để revoke refresh token
