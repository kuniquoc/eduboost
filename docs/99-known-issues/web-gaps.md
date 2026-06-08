# Known Issues — Web (React)

## ❌ Chưa đúng / lỗi

| Vấn đề | File | Chi tiết |
|--------|------|----------|
| Admin redirect sau login | `login-page.tsx` | Non-teacher → `/student/dashboard`; admin phải vào URL thủ công |
| `ROUTES` constants thiếu | `lib/constants.ts` | Không có admin, quiz-pool, ai-chat, practice-session… |

## 🔧 Chưa hoàn thiện

| Vấn đề | File | Chi tiết |
|--------|------|----------|
| Cập nhật tên profile | `profile-page.tsx` | UI có nhưng toast "Cập nhật tên chưa khả dụng" |
| Avatar placeholder | `profile-page.tsx` | Chỉ hiện chữ cái đầu, không upload |
| Demo login buttons | `login-page.tsx` | `docs/features.md` mô tả nhưng không implement |
| Learning paths UI | — | `learningPath.service.ts` zero import |
| Teacher analytics UI | — | `studentsService.getClassAnalytics` / `getStudentAnalytics` không dùng |
| Placement test nav | `App.tsx` | Route `/student/placement-test` không link từ sidebar/dashboard |
| `getRevisionSets` | `pool-dashboard.tsx` | Gọi `apiClient` trực tiếp, không qua `pool.service.ts` |
| `recharts` dependency | `package.json` | Không import trong source |

## ⚠️ Chưa tối ưu

| Vấn đề | File | Chi tiết |
|--------|------|----------|
| Dual entry-test | `entry-test-page.tsx` + `adaptive-placement-test-page.tsx` | Hai luồng song song, dashboard dùng legacy |
| Practice session discoverability | `practice-session-page.tsx` | Không trong sidebar, chỉ từ review page |
| Student classes → roadmap | `classes-page.tsx` | Luôn link roadmap, không check entry-test |
| Inline `useQuery` everywhere | features/* | Không có hooks/ folder, logic lặp |
| Generic README | `web/README.md` | Vite template, không EduBoost-specific |

## Docs lỗi thời

`web-technical-spec.md` liệt kê: `hooks/`, `sidebar.tsx`, `header.tsx`, `difficulty-badge`, `file-upload`, `formatDate` trong utils — **không tồn tại**.

## Liên kết

- [../01-web/README.md](../01-web/README.md)
- [cross-layer-inconsistencies.md](cross-layer-inconsistencies.md)
