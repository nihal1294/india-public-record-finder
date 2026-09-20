# Third-party components

The prototype uses the following direct components. Resolved versions are
listed from the root Python lockfile, the separate OCR-project lockfile, and
the web workspace lockfile. The two `uv_build` build requirements are declared
in the Python manifests but are not package entries in either `uv.lock`; their
declared ranges are shown explicitly. Transitive packages retain their
upstream notices.

## Service runtime

These are the direct packages in the root `pyproject.toml` runtime dependency
set and their resolved versions:

- `fastapi` 0.141.1 - MIT.
- `huggingface-hub` 1.28.0 and `sentence-transformers` 6.0.0 - Apache-2.0.
- `numpy` 2.5.2 - BSD-3-Clause.
- `pillow` 12.3.0 - MIT-CMU.
- `pydantic` 2.13.4, `rapidfuzz` 3.14.5, and `typer`
  0.27.1 - MIT.
- `pypdfium2` 5.13.0 - BSD-3-Clause, Apache-2.0, and its dependency
  licenses, as stated in its package metadata.
- `reportlab` 5.0.1 - BSD-3-Clause.
- `uvicorn[standard]` 0.52.4 - BSD-3-Clause.

SQLite is public domain. The Python standard library is covered primarily by
the Python Software Foundation License, with individual module notices
retained. The service runtime does not include OCR packages or web build/test
tools.

## Root build and development

The root manifest declares `uv_build>=0.12.5,<0.13.0` as its build requirement;
this requirement is not resolved in `uv.lock`. `uv_build` is MIT OR Apache-2.0.

The direct root development packages and their `uv.lock` versions are:

- `httpx` 0.28.1 - BSD-3-Clause.
- `mypy` 2.3.1, `pytest` 9.1.1, `pytest-cov` 7.1.0, and `pytest-socket`
  0.8.1 - MIT.
- `ruff` 0.16.4 - MIT.

These packages support typing, testing, linting, and development; they are not
service-runtime dependencies.

## Deployment tooling

- Modal 1.5.4 (`modal`) - Apache-2.0. It is deploy-only tooling for building the
  repository Dockerfile image and exposing the web service. It is not a
  service-runtime dependency.

## OCR components outside the citizen path

The separate OCR project directly declares these resolved packages in
`ocr/uv.lock`:

- `paddleocr` 3.7.0 and `paddlepaddle` 3.3.1 - Apache-2.0.
- `pillow` 12.3.0 - MIT-CMU; `pydantic` 2.13.4 and `typer` 0.27.1 - MIT.

Its manifest declares `uv_build>=0.12.5,<0.13.0`; that build requirement is
not resolved in `ocr/uv.lock`, and `uv_build` is MIT OR Apache-2.0. OCR is
outside the citizen search path until it meets the required accuracy bar; its
packages are not service-runtime dependencies.

## Web application and tooling

The web workspace importer in `pnpm-lock.yaml` resolves these direct packages:

- Runtime: `react` 19.2.8 and `react-dom` 19.2.8 - MIT.
- `@playwright/test` 1.62.1 - Apache-2.0.
- `@testing-library/react` 16.3.2,
  `@testing-library/user-event` 14.6.5 - MIT.
- `@types/node` 24.13.3, `@types/react` 19.2.18, and `@types/react-dom`
  19.2.4 - MIT.
- `@vitejs/plugin-react` 6.1.0, `jsdom` 30.0.1, `oxlint` 1.79.0, `vite`
  8.2.2, and `vitest` 4.1.11 - MIT.
- `typescript` 6.0.3 - Apache-2.0.

The workspace package manager is `pnpm` 11.19.0 - MIT. Web packages are build,
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
