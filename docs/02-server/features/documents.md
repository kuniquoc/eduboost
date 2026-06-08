# Feature: Documents

> Thư mục: [`server/Features/Documents/`](../../../server/Features/Documents/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `api/classes/{classId:guid}/documents` | `GetClassDocuments` |
| POST | `api/classes/{classId:guid}/documents/request-upload` | `RequestClassUploadUrl` |
| POST | `api/classes/{classId:guid}/documents/confirm` | `ConfirmClassUpload` |
| GET | `api/classes/{classId:guid}/documents/{id:guid}/download` | `GetDownloadUrl` |
| DELETE | `api/classes/{classId:guid}/documents/{id:guid}` | `DeleteClassDocument` |
| POST | `api/classes/{classId:guid}/documents/{id:guid}/generate-quiz` | `GenerateQuizFromDocument` |
| GET | `api/documents/my` | `GetMyDocuments` |
| POST | `api/documents/my/request-upload` | `RequestStudentUploadUrl` |
| POST | `api/documents/my/confirm` | `ConfirmStudentUpload` |
| GET | `api/documents/my/{id:guid}/download` | `GetMyDocumentDownloadUrl` |
| POST | `api/documents/my/{id:guid}/generate-quiz` | `GenerateMyQuiz` |
| DELETE | `api/documents/my/{id:guid}` | `DeleteMyDocument` |

## Repository methods

| Method |
|--------|
| `RequestClassUploadUrlAsync` |
| `ConfirmClassUploadAsync` |
| `DeleteClassDocumentAsync` |
| `GenerateQuizFromDocumentAsync` |
| `GetClassDocumentDownloadUrlAsync` |
| `RequestStudentUploadUrlAsync` |
| `ConfirmStudentUploadAsync` |
| `GenerateMyQuizAsync` |
| `DeleteMyDocumentAsync` |
| `GetStudentDocumentDownloadUrlAsync` |
| `GetByIdAsync` |

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
