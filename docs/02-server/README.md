# Server Backend Documentation

ASP.NET Core 9 API tại [`server/`](../../server/).

## Mục lục

| Doc | Nội dung |
|-----|----------|
| [architecture.md](architecture.md) | Vertical slice, DI, middleware |
| [features/](features/) | 15 feature slices |
| [infrastructure/](infrastructure/) | DB, MinIO, AgentService |
| [entities/](entities.md) | 17 EF entities |
| [flows/](../04-integration/flows/) | Luồng end-to-end |

## Pattern

Mỗi feature = `*Controller.cs` + `*Repository.cs` + `Models/`.

Không có service layer riêng per feature — business logic trong Repository.

## API

~85 endpoints — [api-reference.md](../04-integration/api-reference.md)

## Known issues

[../99-known-issues/server-gaps.md](../99-known-issues/server-gaps.md)
