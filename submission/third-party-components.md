# Third-party components

The prototype uses the following direct components. Exact resolved versions
are recorded in the [service lockfile](../uv.lock),
[OCR lockfile](../ocr/uv.lock), and [web workspace lockfile](../pnpm-lock.yaml).
Build requirements are declared in the [service manifest](../pyproject.toml)
and [OCR manifest](../ocr/pyproject.toml); the workspace package-manager version
is pinned in [package.json](../package.json). Transitive packages retain their
upstream notices.

## Service runtime

These are the direct packages in the root `pyproject.toml` runtime dependency
set:

- `fastapi` - MIT.
- `huggingface-hub` and `sentence-transformers` - Apache-2.0.
- `numpy` - BSD-3-Clause.
- `pillow` - MIT-CMU.
- `pydantic`, `rapidfuzz`, and `typer` - MIT.
- `pypdfium2` - BSD-3-Clause, Apache-2.0, and its dependency
  licenses, as stated in its package metadata.
- `reportlab` - BSD-3-Clause.
- `uvicorn[standard]` - BSD-3-Clause.

SQLite is public domain. The Python standard library is covered primarily by
the Python Software Foundation License, with individual module notices
retained. The service runtime does not include OCR packages or web build/test
tools.

## Root build and development

The root manifest declares `uv_build` as its build requirement; this
requirement is not resolved in `uv.lock`. `uv_build` is MIT OR Apache-2.0.

The direct root development packages are:

- `httpx` - BSD-3-Clause.
- `mypy`, `pytest`, `pytest-cov`, and `pytest-socket` - MIT.
- `ruff` - MIT.

These packages support typing, testing, linting, and development; they are not
service-runtime dependencies.

## Deployment tooling

- Modal (`modal`) - Apache-2.0. It is deploy-only tooling for building the
  repository Dockerfile image and exposing the web service. It is not a
  service-runtime dependency.

## OCR components outside the citizen path

The separate OCR project directly declares these packages:

- `paddleocr` and `paddlepaddle` - Apache-2.0.
- `pillow` - MIT-CMU; `pydantic` and `typer` - MIT.

Its manifest declares `uv_build`; that build requirement is not resolved
in `ocr/uv.lock`, and `uv_build` is MIT OR Apache-2.0. OCR is
outside the citizen search path until it meets the required accuracy bar; its
packages are not service-runtime dependencies.

## Web application and tooling

The web workspace directly declares these packages:

- Runtime: `react` and `react-dom` - MIT.
- `@playwright/test` - Apache-2.0.
- `@testing-library/react` and `@testing-library/user-event` - MIT.
- `@types/node`, `@types/react`, and `@types/react-dom` - MIT.
- `@vitejs/plugin-react`, `jsdom`, `oxlint`, `vite`, and `vitest` - MIT.
- `typescript` - Apache-2.0.

The workspace package manager is `pnpm` - MIT. Web packages are build,
development, and test components. The browser does not encode queries or run
the retrieval model.

## Models

- `intfloat/multilingual-e5-small`, revision
  `614241f622f53c4eeff9890bdc4f31cfecc418b3` - MIT. It is the self-hosted
  multilingual retrieval model; citizen queries are encoded in the service
  without egress to a third-party embedding provider.
- `PaddlePaddle/ka_PP-OCRv3_mobile_rec`, revision
  `fd08732bad5fb532cf883cb42a75ed139a72ab18`, and
  `PaddlePaddle/en_PP-OCRv4_mobile_rec`, revision
  `f97b62fdc0eb71c689393a19a4b21baa1795c9ab` - Apache-2.0. OCR is outside
  the citizen search path; no OCR output is indexed or shown by the product.

## Bundled asset

`apps/web/public/fonts/noto-sans-kannada/NotoSansKannada-Regular.ttf` is the Google Fonts
static source v32, licensed under SIL Open Font License 1.1. The complete OFL
text is bundled beside the font in `OFL.txt`. Its verified SHA-256 is
`4b8dd08fc05afa13cc8daa8ac2187f35711be026286db8608e87c86f715e273d`, as also
recorded in `THIRD_PARTY_NOTICES.md`.

## Data and boundary

The demo snapshot, source pages, evidence crops, aliases, and examples are
deterministic fictional data. No real public-record data is bundled, and no
third-party embedding provider, analytics, or live government service is used
in the citizen search path.
