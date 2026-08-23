"""Manifest-bound FastAPI application with no runtime ingestion surface."""

import logging
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from urllib.parse import unquote

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles

from record_finder.api.contracts import (
    HealthResponse,
    MatchReason,
    RecordResponse,
    SearchCandidate,
    SearchRequest,
    SearchResponse,
)
from record_finder.api.privacy import EphemeralRateLimiter
from record_finder.index.manifest import SnapshotManifest, validate_evidence_id
from record_finder.integrity import sha256_path
from record_finder.search.dense import EncoderUnavailable, LocalE5Encoder
from record_finder.search.service import QueryEncoder, SearchQuery, SearchService
from record_finder.search.service import SearchCandidate as DomainCandidate
from record_finder.search.service import SearchResponse as DomainSearchResponse

logger = logging.getLogger("record_finder.api")


@dataclass
class _Runtime:
    service: SearchService | None = None
    manifest: SnapshotManifest | None = None
    ready: bool = False


def _source_part(part_number: int) -> str:
    return f"KA-{part_number:02d}"


def _has_encoded_traversal(raw_path: bytes) -> bool:
    """Reject percent-encoded parent segments before a static mount can resolve them."""
    decoded = raw_path.decode("ascii", errors="ignore")
    for _ in range(3):
        if any(segment == ".." for segment in decoded.split("/")):
            return True
        next_value = unquote(decoded)
        if next_value == decoded:
            return False
        decoded = next_value
    return any(segment == ".." for segment in decoded.split("/"))


def _match_label(score: float) -> str:
    if score >= 0.95:
        return "Exact match"
    if score >= 0.85:
        return "Close match"
    return "Related match"


def _candidate_reasons(candidate: DomainCandidate) -> list[MatchReason]:
    fields = (
        ("name", "Name", candidate.name_native, candidate.field_scores.name),
        (
            "relative_name",
            "Relative's name",
            candidate.relative_name_latin,
            candidate.field_scores.relative_name,
        ),
        ("locality", "Locality", candidate.locality_latin, candidate.field_scores.locality),
        ("age", "Age", str(candidate.age), candidate.field_scores.age),
    )
    return [
        MatchReason(field=label, value=value, match=_match_label(score))
        for key, label, value, score in fields
        if key in candidate.match_reasons and score is not None
    ]


def _candidate_response(candidate: DomainCandidate) -> SearchCandidate:
    return SearchCandidate(
        synthetic_id=candidate.synthetic_id,
        name=candidate.name_native,
        latin_name=candidate.name_latin,
        relative_name=candidate.relative_name_latin,
        locality=candidate.locality_latin,
        age=candidate.age,
        evidence_id=candidate.source.evidence_id,
        source_part=_source_part(candidate.source.part_number),
        source_page=candidate.source.page_number,
        match_reasons=_candidate_reasons(candidate),
    )


def _public_candidates(result: DomainSearchResponse) -> tuple[DomainCandidate, ...]:
    """Expose only candidates that are safe for the response state."""
    if result.state == "possible_match":
        return result.candidates[:1]
    if result.state == "no_confident_result":
        return ()
    if result.state in {"needs_more_detail", "limited_search"}:
        return tuple(candidate for candidate in result.candidates if candidate.final_score >= 0.55)
    return ()


def _record_response(candidate: DomainCandidate) -> RecordResponse:
    return RecordResponse(
        synthetic_id=candidate.synthetic_id,
        name=candidate.name_native,
        latin_name=candidate.name_latin,
        relative_name=candidate.relative_name_latin,
        locality=candidate.locality_latin,
        age=candidate.age,
        evidence_id=candidate.source.evidence_id,
        source_part=_source_part(candidate.source.part_number),
        source_page=candidate.source.page_number,
    )


def create_app(
    snapshot_path: Path,
    web_root: Path | None = None,
    *,
    model_cache: Path | None = None,
    model_manifest_path: Path | None = None,
    encoder: QueryEncoder | None = None,
) -> FastAPI:
    """Create a read-only service over one verified synthetic snapshot.

    Production callers must pass ``model_cache`` explicitly. Test callers may
    provide a deterministic in-process encoder that implements ``QueryEncoder``.
    """
    if encoder is None and model_cache is not None and model_manifest_path is not None:
        encoder = LocalE5Encoder(model_cache / "multilingual-e5-small", model_manifest_path)
    runtime = _Runtime()
    limiter = EphemeralRateLimiter()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        service: SearchService | None = None
        try:
            service = SearchService(snapshot_path, encoder=encoder)
            if encoder is None or not encoder.available:
                raise EncoderUnavailable("no verified encoder")
            probe = encoder.encode_query("health check")
            if not isinstance(probe, np.ndarray) or probe.shape != (384,):
                raise EncoderUnavailable("encoder readiness probe failed")
            runtime.service = service
            runtime.manifest = service.manifest
            runtime.ready = True
        except EncoderUnavailable, OSError, ValueError:
            runtime.ready = False
            if service is not None:
                service.close()
            runtime.service = None
        try:
            yield
        finally:
            if runtime.service is not None:
                runtime.service.close()

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.state.rate_limiter = limiter

    @app.middleware("http")
    async def privacy_headers(request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
        request.state.request_id = secrets.token_hex(16)
        started = perf_counter()
        raw_path = request.scope.get("raw_path", b"")
        is_api_request = request.url.path.startswith("/api/") or raw_path.startswith(b"/api/")
        client_host = request.client.host if request.client is not None else "unknown"
        if is_api_request and _has_encoded_traversal(raw_path):
            response: Response = JSONResponse({"detail": "not found"}, status_code=404)
        elif (
            request.url.path == "/api/search"
            and request.method == "POST"
            and not limiter.allow(client_host)
        ):
            response = JSONResponse({"detail": "request unavailable"}, status_code=429)
        else:
            try:
                response = await call_next(request)
            except Exception:
                response = JSONResponse({"detail": "service unavailable"}, status_code=500)
        if is_api_request or request.url.path == "/healthz":
            response.headers["Cache-Control"] = "no-store"
        route = request.scope.get("route")
        route_path = getattr(route, "path", "unmatched")
        result_count = int(getattr(request.state, "result_count", 0))
        error_class = "none" if response.status_code < 400 else "client_or_service_error"
        logger.info(
            "request_complete route=%s status=%d duration_ms=%d result_count=%d error_class=%s",
            route_path,
            response.status_code,
            int((perf_counter() - started) * 1000),
            result_count,
            error_class,
        )
        return response

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_: Request, __: RequestValidationError) -> JSONResponse:
        return JSONResponse({"detail": "invalid request"}, status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, error: StarletteHTTPException) -> JSONResponse:
        if error.status_code == 405:
            detail = "method not allowed"
        elif error.status_code == 503 and error.detail in {
            "evidence unavailable",
            "service unavailable",
        }:
            detail = str(error.detail)
        else:
            detail = "not found"
        return JSONResponse({"detail": detail}, status_code=error.status_code)

    def require_ready() -> tuple[SearchService, SnapshotManifest]:
        if not runtime.ready or runtime.service is None or runtime.manifest is None:
            raise HTTPException(status_code=503, detail="service unavailable")
        return runtime.service, runtime.manifest

    @app.post("/api/search", response_model=SearchResponse)
    async def search(request: Request, payload: SearchRequest) -> SearchResponse:
        service, _ = require_ready()
        result = service.search(
            SearchQuery(
                name=payload.name,
                relative_name=payload.relative_name,
                locality=payload.locality,
                age=payload.age,
                limit=payload.limit,
            )
        )
        candidates = _public_candidates(result)
        request.state.result_count = len(candidates)
        return SearchResponse(
            state=result.state,
            candidates=[_candidate_response(candidate) for candidate in candidates],
        )

    @app.get("/api/records/{synthetic_id}", response_model=RecordResponse)
    async def record(synthetic_id: str) -> RecordResponse:
        service, manifest = require_ready()
        if synthetic_id not in manifest.record_ids:
            raise HTTPException(status_code=404, detail="not found")
        record_value = service._records.get(synthetic_id)
        if record_value is None:
            raise HTTPException(status_code=404, detail="not found")
        return RecordResponse(
            synthetic_id=record_value.synthetic_id,
            name=record_value.name_native,
            latin_name=record_value.name_latin,
            relative_name=record_value.relative_name_latin,
            locality=record_value.locality_latin,
            age=record_value.age,
            evidence_id=record_value.source.evidence_id,
            source_part=_source_part(record_value.source.part_number),
            source_page=record_value.source.page_number,
        )

    @app.get("/api/evidence/{evidence_id}")
    async def evidence(evidence_id: str) -> FileResponse:
        _, manifest = require_ready()
        try:
            validate_evidence_id(evidence_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="not found") from None
        digest = manifest.evidence.get(evidence_id)
        if digest is None:
            raise HTTPException(status_code=404, detail="not found")
        evidence_root = snapshot_path.parent.resolve() / "evidence"
        candidate = (evidence_root / f"{evidence_id}.png").resolve()
        if not candidate.is_relative_to(evidence_root) or not candidate.is_file():
            raise HTTPException(status_code=404, detail="not found")
        if sha256_path(candidate) != digest:
            raise HTTPException(status_code=503, detail="evidence unavailable")
        return FileResponse(candidate, media_type="image/png")

    @app.get("/api/examples")
    async def examples() -> list[dict[str, object]]:
        _, manifest = require_ready()
        return [example.model_dump(mode="json") for example in manifest.demo_examples]

    async def method_not_allowed() -> None:
        raise HTTPException(status_code=405, detail="method not allowed")

    non_search_methods = ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]
    app.add_api_route("/api/records/{synthetic_id}", method_not_allowed, methods=non_search_methods)
    app.add_api_route("/api/evidence/{evidence_id}", method_not_allowed, methods=non_search_methods)
    app.add_api_route("/api/examples", method_not_allowed, methods=non_search_methods)
    app.add_api_route(
        "/api/search",
        method_not_allowed,
        methods=["GET", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    )

    async def api_not_found(unmatched_path: str) -> None:
        raise HTTPException(status_code=404, detail="not found")

    app.add_api_route(
        "/api/{unmatched_path:path}",
        api_not_found,
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    )

    @app.get("/healthz", response_model=HealthResponse)
    async def health() -> JSONResponse:
        if runtime.ready:
            return JSONResponse({"status": "ready"})
        return JSONResponse({"status": "unavailable"}, status_code=503)

    if web_root is not None:
        app.mount("/", StaticFiles(directory=web_root, html=True), name="web")
    return app
