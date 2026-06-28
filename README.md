# EduBoost

EduBoost là monorepo gồm React web app, ASP.NET Core API và FastAPI AI agent.

## Bản đồ repository

```text
web/                    React/Vite frontend theo feature-first
server/                 ASP.NET Core API theo vertical slice
ai-agent-core/          Python runtime package và offline AI tools
tests/server/           Test project của ASP.NET Core API
docs/                   Tài liệu kiến trúc và luồng tích hợp
docker-compose.yml      Local full stack
```

Frontend đặt API, hook, type, component, page và test trong cùng
`web/src/features/<domain>/`. Backend đặt HTTP và data-access code trong
`server/Features/<Domain>/`; persistence và external integrations nằm dưới
`server/Infrastructure/`. Chỉ runtime code của AI nằm trong
`ai-agent-core/src/eduboost_agent/`; evaluation, dataset và training code nằm
trong `ai-agent-core/tools/`.

## Lệnh thường dùng

```powershell
# Web
cd web
npm install
npm run dev
npm test
npm run build

# Server
cd ..
dotnet test tests/server/EduBoost.API.Tests/EduBoost.API.Tests.csproj

# AI agent
cd ai-agent-core
python -m pip install -r requirements-dev.txt
python -m pytest
uvicorn eduboost_agent.api.main:app --app-dir src --reload

# Full stack
cd ..
docker compose up --build
```

Tài liệu chi tiết bắt đầu tại [docs/README.md](docs/README.md).
