# India Public Record Finder

India Public Record Finder is a Karnataka-first, evidence-first prototype for
finding possible matches in a fictional historical roll and checking the
source crop before deciding. It is independent, synthetic-only, and does not
determine voter registration, identity, or eligibility.

## Package boundaries

- `src/record_finder/` contains the read-only API, hybrid retrieval, synthetic
  snapshot validation, and offline build tools.
- `apps/web/` contains the guided React browser application.
- `data/synthetic/demo-v1/` contains the immutable fictional demo snapshot.
- `models/manifest.json` pins the self-hosted multilingual retrieval model.

The domain package uses an explicit synthetic classification for fixture
payloads.

## Setup and validation

Python uses CPython 3.14 and uv. Node uses pnpm. Fetch the model to an
operator-controlled cache outside the repository, then use it for the live
service:

```bash
uv run python scripts/fetch_models.py multilingual_e5_small \
  --destination /path/to/model-cache --manifest models/manifest.json
pnpm web:build
uv run record-finder serve \
  --snapshot data/synthetic/demo-v1/manifest.json \
  --model-cache /path/to/model-cache \
  --model-manifest models/manifest.json \
  --web-root apps/web/dist
```

Use the following commands to validate the repository:

```bash
uv run pytest -q
uv run ruff check src tests
uv run mypy src
pnpm web:test
pnpm web:build
pnpm e2e
```

The service exposes only search, record, evidence, example, and readiness
routes. Live queries are encoded using the pinned model in the service; they
are not sent to an LLM or embedding provider. The browser does not store query
data in URLs or browser storage.

## Container

The `Dockerfile` builds the browser application with Node 24 and packages it
with the CPython 3.14 service, verified fictional snapshot, and pinned model.
It runs as a non-root user and starts the read-only `record-finder serve`
entrypoint. Build with `docker build -t india-public-record-finder .` and run
with `docker run --rm -p 8080:8080 india-public-record-finder`.

## Privacy boundary

Do not add personal data, voter rolls, identity documents, scraped records, or
production exports to this repository. Keep all examples and fixtures
synthetic. The product does not provide an official determination.

## Contribution principles

Contributions preserve the synthetic-only boundary, add focused tests for
observable behavior, and pass the relevant validation commands.
