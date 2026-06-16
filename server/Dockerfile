# ── Build stage ───────────────────────────────────────────────────────────────
FROM ubuntu:24.04 AS build
WORKDIR /src

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates libicu74 \
    && rm -rf /var/lib/apt/lists/* \
    && curl -sSL https://dot.net/v1/dotnet-install.sh \
    | bash /dev/stdin --channel 9.0 --install-dir /usr/share/dotnet \
    && ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet

COPY ["EduBoost.API.csproj", "."]
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM ubuntu:24.04 AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates libicu74 libssl3 libstdc++6 \
    && rm -rf /var/lib/apt/lists/* \
    && curl -sSL https://dot.net/v1/dotnet-install.sh \
    | bash /dev/stdin --channel 9.0 --runtime aspnetcore \
    --install-dir /usr/share/dotnet \
    && ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet

COPY --from=build /app/publish .

RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "EduBoost.API.dll"]