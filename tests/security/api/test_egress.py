"""Privacy and egress contracts for live API requests."""

import logging
import os
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from typer.testing import CliRunner

from record_finder.api.app import create_app
from record_finder.index.builder import build_demo_snapshot
from record_finder.search.service import SearchService
from record_finder.synthetic.render import render_demo_source


class _Encoder:
    available = True
    dimensions = 384
    model_key = "multilingual_e5_small"
    repo_id = "intfloat/multilingual-e5-small"
    revision = "614241f622f53c4eeff9890bdc4f31cfecc418b3"

    def __init__(self) -> None:
        self.calls: list[str] = []

    def encode_records(self, texts: list[str]) -> np.ndarray:
        matrix = np.zeros((len(texts), 384), dtype=np.float32)
        matrix[:, 0] = 1.0
        return matrix

    def encode_query(self, text: str) -> np.ndarray:
        self.calls.append(text)
        vector = np.zeros(384, dtype=np.float32)
        vector[0] = 1.0
        return vector


def test_unique_query_is_not_logged_or_persisted(tmp_path: Path, caplog) -> None:  # type: ignore[no-untyped-def]
    snapshot = tmp_path / "snapshot"
    builder_encoder = _Encoder()
    build_demo_snapshot(
        render_demo_source(tmp_path / "source"), snapshot, dense_encoder=builder_encoder
    )
    encoder = _Encoder()
    app = create_app(snapshot / "manifest.json", encoder=encoder)
    secret_query = "Tamarind-Blue-Canopy-734"

    with caplog.at_level(logging.INFO, logger="record_finder.api"):
        with TestClient(app) as client:
            response = client.post("/api/search", json={"name": secret_query})

    assert response.status_code == 200
    assert secret_query not in caplog.text
    assert secret_query not in repr(app.state._state)
    assert all(secret_query not in key for key in app.state.rate_limiter.bucket_keys())
    assert encoder.calls == ["health check", secret_query]


def test_live_api_requests_do_not_require_network(tmp_path: Path) -> None:
    snapshot = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), snapshot, dense_encoder=_Encoder())
    app = create_app(snapshot / "manifest.json", encoder=_Encoder())

    with TestClient(app) as client:
        response = client.post("/api/search", json={"name": "ಅನನ್ಯಾ ಗೌಡ"})

    assert response.status_code == 200


def test_unhandled_search_error_is_generic_and_not_cacheable(
    tmp_path: Path, caplog, monkeypatch: pytest.MonkeyPatch
) -> None:
    snapshot = tmp_path / "snapshot"
    build_demo_snapshot(render_demo_source(tmp_path / "source"), snapshot, dense_encoder=_Encoder())
    app = create_app(snapshot / "manifest.json", encoder=_Encoder())
    secret = "exception-Tamarind-Blue-Canopy-734"

    def fail_search(self: SearchService, query: object) -> object:
        raise RuntimeError(secret)

    monkeypatch.setattr(SearchService, "search", fail_search)
    with caplog.at_level(logging.INFO, logger="record_finder.api"):
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.post("/api/search", json={"name": "Ananya"})

    assert response.status_code == 500
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"detail": "service unavailable"}
    assert secret not in caplog.text


def test_serve_disables_forwarded_proxy_headers(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import uvicorn

    from record_finder import cli
    from record_finder.api import app as api_app

    snapshot = tmp_path / "manifest.json"
    model_cache = tmp_path / "model-cache"
    model_manifest = tmp_path / "models.json"
    snapshot.write_text("{}", encoding="utf-8")
    model_cache.mkdir()
    model_manifest.write_text("{}", encoding="utf-8")
    captured: dict[str, object] = {}
    sentinel = object()
    monkeypatch.setattr(api_app, "create_app", lambda *args, **kwargs: sentinel)
    monkeypatch.setattr(uvicorn, "run", lambda *args, **kwargs: captured.update(kwargs))

    result = CliRunner().invoke(
        cli.app,
        [
            "serve",
            "--snapshot",
            str(snapshot),
            "--model-cache",
            str(model_cache),
            "--model-manifest",
            str(model_manifest),
        ],
    )

    assert result.exit_code == 0
    assert captured["proxy_headers"] is False
    assert captured["access_log"] is False


@pytest.mark.skipif(
    not os.environ.get("RECORD_FINDER_TEST_MODEL_CACHE"),
    reason="requires an operator-provided verified local E5 cache",
)
def test_actual_local_e5_api_search_does_not_use_network(tmp_path: Path) -> None:
    from record_finder.search.dense import LocalE5Encoder

    snapshot = tmp_path / "snapshot"
    model_cache = Path(os.environ["RECORD_FINDER_TEST_MODEL_CACHE"])
    encoder = LocalE5Encoder(model_cache / "multilingual-e5-small", Path("models/manifest.json"))
    build_demo_snapshot(render_demo_source(tmp_path / "source"), snapshot, dense_encoder=encoder)
    app = create_app(
        snapshot / "manifest.json",
        model_cache=model_cache,
        model_manifest_path=Path("models/manifest.json"),
    )

    with TestClient(app) as client:
        response = client.post("/api/search", json={"name": "Ananya Gowdaa"})

    assert response.status_code == 200
