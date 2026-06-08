# Infrastructure: MinioStorageService

> File: [`server/Infrastructure/Storage/MinioStorageService.cs`](../../../server/Infrastructure/Storage/MinioStorageService.cs)

## Buckets

| Bucket | Scope |
|--------|-------|
| `eduboost-class-docs` | Teacher class documents |
| `eduboost-student-docs` | Student private documents |

## Endpoints config

| Key | Dùng cho |
|-----|----------|
| `MinIO:Endpoint` | Internal server → MinIO |
| `MinIO:PublicEndpoint` | Presigned URL cho browser upload/download |
| `MinIO:AgentEndpoint` | Presigned URL cho AI agent ingest (fallback internal) |

## Operations (IStorageService)

| Method | Mô tả |
|--------|-------|
| Presigned upload PUT | Client upload trực tiếp |
| Presigned download GET | Browser download |
| Internal presigned | Agent đọc file cho RAG |
| Delete object | Khi xóa document |
| Direct upload | DatabaseSeeder |

## Luồng upload

1. `request-upload` → tạo Document pending + presigned PUT
2. Client PUT file
3. `confirm` → status `ready` + background RAG ingest

## Known issues

- Ingest failure không rollback document status
