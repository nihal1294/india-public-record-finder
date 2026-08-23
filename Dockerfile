# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS web-build
WORKDIR /workspace
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN corepack enable && pnpm install --frozen-lockfile
COPY apps/web apps/web
RUN pnpm --dir apps/web build

FROM python:3.14-slim AS service-build
COPY --from=ghcr.io/astral-sh/uv:0.12.5 /uv /usr/local/bin/uv
WORKDIR /build
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY models/manifest.json models/manifest.json
COPY scripts/fetch_models.py scripts/fetch_models.py
RUN .venv/bin/python scripts/fetch_models.py multilingual_e5_small \
    --destination /opt/model-cache --manifest models/manifest.json \
    && mkdir -p /opt/runtime-model-cache \
    && cp -aL /opt/model-cache/multilingual-e5-small /opt/runtime-model-cache/multilingual-e5-small

FROM python:3.14-slim
ENV PATH=/app/.venv/bin:$PATH \
    PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
RUN groupadd --system recordfinder && useradd --system --gid recordfinder --home-dir /app recordfinder
WORKDIR /app
COPY --from=service-build /build/.venv /app/.venv
COPY --from=service-build /opt/runtime-model-cache /app/model-cache
COPY models/manifest.json /app/models/manifest.json
COPY data/synthetic/demo-v1 /app/data/synthetic/demo-v1
COPY src/record_finder/__init__.py src/record_finder/integrity.py src/record_finder/runtime.py /app/record_finder/
COPY src/record_finder/api /app/record_finder/api
COPY src/record_finder/domain /app/record_finder/domain
COPY src/record_finder/index/__init__.py src/record_finder/index/manifest.py /app/record_finder/index/
COPY src/record_finder/search /app/record_finder/search
COPY scripts/record-finder-runtime /usr/local/bin/record-finder
COPY --from=web-build /workspace/apps/web/dist /app/web
RUN chmod 0555 /usr/local/bin/record-finder
USER recordfinder
EXPOSE 8080
ENTRYPOINT ["record-finder"]
CMD ["serve", "--snapshot", "/app/data/synthetic/demo-v1/manifest.json", "--model-cache", "/app/model-cache", "--model-manifest", "/app/models/manifest.json", "--web-root", "/app/web", "--host", "0.0.0.0", "--port", "8080"]
