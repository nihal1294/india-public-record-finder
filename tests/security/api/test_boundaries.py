"""Read-only and data-boundary API tests."""

from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from record_finder.api import privacy
from record_finder.api.app import create_app
from record_finder.api.privacy import EphemeralRateLimiter
from record_finder.index.builder import build_demo_snapshot
from record_finder.synthetic.render import render_demo_source


class _Encoder:
    available = True
    dimensions = 384
    model_key = "multilingual_e5_small"
    repo_id = "intfloat/multilingual-e5-small"
    revision = "614241f622f53c4eeff9890bdc4f31cfecc418b3"

    def encode_records(self, texts: list[str]) -> np.ndarray:
        matrix = np.zeros((len(texts), 384), dtype=np.float32)
        matrix[:, 0] = 1.0
        return matrix

    def encode_query(self, text: str) -> np.ndarray:
        vector = np.zeros(384, dtype=np.float32)
        vector[0] = 1.0
        return vector


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    snapshot = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), snapshot, dense_encoder=_Encoder())
    app = create_app(snapshot / "manifest.json", encoder=_Encoder())
    with TestClient(app) as test_client:
        yield test_client


def test_runtime_has_no_ingestion_or_ocr_surface(client: TestClient) -> None:
    for path in (
        "/api/ocr",
        "/api/ingest",
        "/api/index",
        "/api/upload",
        "/api/admin",
        "/api/jobs",
        "/api/modal",
    ):
        response = client.get(path)
        assert response.status_code == 404
        assert response.headers["cache-control"] == "no-store"


def test_evidence_is_manifest_bound_and_path_safe(client: TestClient) -> None:
    evidence = client.get("/api/evidence/evidence-SYN-KA-A")
    traversal = client.get("/api/evidence/%2E%2E%2Fmanifest.json")
    unknown = client.get("/api/evidence/evidence-SYN-KA-Z")

    assert evidence.status_code == 200
    assert evidence.headers["content-type"].startswith("image/png")
    assert traversal.status_code == 404
    assert unknown.status_code == 404
    for response in (evidence, traversal, unknown):
        assert response.headers["cache-control"] == "no-store"


def test_api_never_sets_a_cookie(client: TestClient) -> None:
    for response in (
        client.get("/api/examples"),
        client.post("/api/search", json={"name": "Ananya"}),
        client.get("/api/records/SYN-KA-A"),
        client.get("/api/evidence/evidence-SYN-KA-A"),
    ):
        assert "set-cookie" not in response.headers


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete", "options"])
def test_demo_catalog_is_get_only_and_never_sets_a_cookie(
    client: TestClient, method: str
) -> None:
    get_response = client.get("/api/demo/records")
    response = getattr(client, method)("/api/demo/records")

    assert get_response.status_code == 200
    assert get_response.headers["cache-control"] == "no-store"
    assert "set-cookie" not in get_response.headers
    assert response.status_code == 405
    assert response.headers["cache-control"] == "no-store"
    assert "set-cookie" not in response.headers
    assert response.json() == {"detail": "method not allowed"}


def test_demo_catalog_head_is_not_allowed_and_never_sets_a_cookie(client: TestClient) -> None:
    response = client.head("/api/demo/records")

    assert response.status_code == 405
    assert response.headers["cache-control"] == "no-store"
    assert "set-cookie" not in response.headers


def test_general_records_list_route_is_not_exposed(client: TestClient) -> None:
    response = client.get("/api/records")

    assert response.status_code == 404
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"detail": "not found"}


def test_rate_limit_is_ephemeral_and_never_cacheable(client: TestClient) -> None:
    for _ in range(30):
        assert client.post("/api/search", json={"name": "Ananya"}).status_code == 200

    response = client.post("/api/search", json={"name": "Ananya"})

    assert response.status_code == 429
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"detail": "request unavailable"}


def test_rate_limiter_prunes_expired_buckets_and_caps_opaque_memory(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = 0.0
    monkeypatch.setattr(privacy, "monotonic", lambda: now)
    limiter = EphemeralRateLimiter(max_requests=1, window_seconds=60.0, max_buckets=2)
    assert limiter.allow("first-client")
    assert limiter.allow("second-client")
    assert len(limiter.bucket_keys()) == 2
    assert limiter.allow("third-client")
    assert len(limiter.bucket_keys()) == 2

    now = 61.0
    assert limiter.allow("fresh-client")
    assert len(limiter.bucket_keys()) == 1
    assert all("client" not in key for key in limiter.bucket_keys())


def test_evidence_digest_is_checked_for_every_request(tmp_path: Path) -> None:
    snapshot = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), snapshot, dense_encoder=_Encoder())
    app = create_app(snapshot / "manifest.json", encoder=_Encoder())
    evidence_path = snapshot / "evidence" / "evidence-SYN-KA-A.png"

    with TestClient(app) as client:
        evidence_path.write_bytes(evidence_path.read_bytes() + b"changed")
        response = client.get("/api/evidence/evidence-SYN-KA-A")

    assert response.status_code == 503
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"detail": "evidence unavailable"}
