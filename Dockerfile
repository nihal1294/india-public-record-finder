# syntax=docker/dockerfile:1

FROM node:26-bookworm-slim AS web-build
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --global pnpm@12.5.1 && pnpm install --frozen-lockfile
COPY apps/web apps/web
RUN pnpm --dir apps/web build

FROM ghcr.io/astral-sh/uv:0.13.8 AS uv

FROM cgr.dev/chainguard/wolfi-base@sha256:1f6b749929164c3d9e7cad0289254f39b2ba51e1dddaeb0fa57532ea03f2db31 AS python-base
USER root
RUN apk upgrade --no-cache && apk add --no-cache \
    ca-certificates-bundle libstdc++ libgomp openssl-3.6-libssl \
    sqlite-libs ncurses readline libffi libbz2-1 mpdecimal zlib \
    so:liblzma.so.5 so:libexpat.so.1 so:libzstd.so.1

FROM python-base AS python-build
RUN apk add --no-cache build-base bzip2-dev coreutils curl expat-dev gnutar libffi-dev \
    mpdecimal-dev ncurses-dev openssl-3.6-dev pkgconf readline-dev sqlite-dev xz xz-dev \
    zlib-dev zstd-dev
ENV PYTHON_VERSION=3.14.10 \
    PYTHON_SHA256=de414a57119abef52784d8993e341d53aed635fc2b05c2607d9f98a2c5b72032
RUN set -eux; \
    curl -fsSL --retry 3 -o /tmp/python.tar.xz "https://www.python.org/ftp/python/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tar.xz"; \
    echo "${PYTHON_SHA256}  /tmp/python.tar.xz" | sha256sum -c -; \
    xz -d /tmp/python.tar.xz; \
    mkdir /tmp/python; tar -xf /tmp/python.tar -C /tmp/python --strip-components=1; \
    cd /tmp/python; \
    ./configure --enable-shared --without-ensurepip --with-system-libmpdec LDFLAGS='-Wl,-rpath,/usr/local/lib'; \
    make -j "$(nproc)"; make install; \
    rm -rf /usr/local/lib/python3.14/ensurepip; \
    ln -s python3 /usr/local/bin/python

FROM python-base AS python-runtime
COPY --from=python-build /usr/local /usr/local
ENV PATH=/usr/local/bin:$PATH LANG=C.UTF-8

FROM python-runtime AS service-build
COPY --from=uv /uv /usr/local/bin/uv
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

FROM python-runtime AS runtime
ENV PATH=/app/.venv/bin:$PATH \
    PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
RUN addgroup -S recordfinder && adduser -S -D -H -G recordfinder recordfinder
WORKDIR /app
COPY LICENSE /app/LICENSE
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
