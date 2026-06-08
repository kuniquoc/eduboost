# Feature: Classes

> Thư mục: [`server/Features/Classes/`](../../../server/Features/Classes/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `api/classes` | `GetClasses` |
| POST | `api/classes` | `CreateClass` |
| GET | `api/classes/{id:guid}` | `GetClass` |
| PUT | `api/classes/{id:guid}` | `UpdateClass` |
| DELETE | `api/classes/{id:guid}` | `DeleteClass` |
| GET | `api/classes/{id:guid}/students` | `GetStudents` |
| POST | `api/classes/{id:guid}/students` | `AddStudent` |
| DELETE | `api/classes/{id:guid}/students/{studentId:guid}` | `RemoveStudent` |
| GET | `api/classes/enrolled` | `GetEnrolled` |
| POST | `api/classes/join` | `JoinClass` |

## Repository methods

| Method |
|--------|
| `GetByIdAsync` |
| `CreateAsync` |
| `UpdateAsync` |
| `DeleteAsync` |
| `JoinByCodeAsync` |
| `AddStudentAsync` |
| `RemoveStudentAsync` |

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
