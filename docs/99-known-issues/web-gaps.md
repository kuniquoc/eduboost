# Known Issues — Web (React)

## ❌ Chưa đúng / lỗi

_Không còn mục critical sau audit 2026-06-10._

## 🔧 Chưa hoàn thiện

_Không còn mục open._

## ⚠️ Chưa tối ưu

_Không còn mục open._

## ✅ Đã xử lý (2026-06-10 audit + follow-up)

| Vấn đề | Giải pháp |
|--------|-----------|
| Student AI Lab delete 403 | `deleteMyQuestion` → `DELETE /api/quizzes/my/{quizId}/questions/{qId}` |
| Sidebar "Luyện tập" không topicId | Gỡ nav item; practice-session redirect nếu thiếu topicId |
| EXPLAIN step bị skip | Wire `explainMutation` khi `action === 'EXPLAIN'` |
| Ingest status stuck | `refetchInterval` khi doc `ingesting`/`processing` |
| ingest_failed no retry | Nút "Thử lại RAG" (re-confirm upload) |
| Analytics "entry test" copy | Đổi thành "placement test" |
| Chunk size > 500kB | `React.lazy` route splitting + `manualChunks` trong vite.config |
| hooks migration | 23 hooks trong `web/src/hooks/` |

## Liên kết

- [../01-web/README.md](../01-web/README.md)
- [cross-layer-inconsistencies.md](cross-layer-inconsistencies.md)
