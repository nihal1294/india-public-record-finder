"""Snapshot-backed API contracts."""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from record_finder.api.app import create_app
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


def test_search_is_post_only_and_not_cacheable(client: TestClient) -> None:
    assert client.get("/api/search?name=Ananya").status_code == 405
    response = client.post("/api/search", json={"name": "Ananya Gowdaa"})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"


def test_search_maps_possible_candidate_to_browser_contract(client: TestClient) -> None:
    response = client.post(
        "/api/search",
        json={
            "name": "Ananya Gowdaa",
            "relative_name": "Ramesh Gowda",
            "locality": "Chennapura",
            "age": 28,
            "limit": 1,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["state"] == "possible_match"
    assert set(payload) == {"state", "candidates"}
    assert len(payload["candidates"]) == 1
    candidate = payload["candidates"][0]
    assert candidate["synthetic_id"] == "SYN-KA-A"
    assert set(candidate) == {
        "synthetic_id",
        "name",
        "latin_name",
        "relative_name",
        "locality",
        "age",
        "evidence_id",
        "source_part",
        "source_page",
        "match_reasons",
    }
    assert candidate["name"] == "ಅನನ್ಯಾ ಗೌಡ"
    assert candidate["latin_name"] == "Ananya Gowda"
    assert candidate["relative_name"] == "Ramesh Gowda"
    assert candidate["locality"] == "Chennapura"
    assert candidate["evidence_id"] == "evidence-SYN-KA-A"
    assert candidate["source_part"] == "KA-01"
    assert candidate["source_page"] == 1
    assert candidate["match_reasons"]
    assert set(candidate["match_reasons"][0]) == {"field", "value", "match"}
    assert "Gowdaa" not in str(payload)


def test_nonidentical_high_similarity_fields_are_not_labeled_exact(client: TestClient) -> None:
    response = client.post(
        "/api/search",
        json={
            "name": "Ananya Gowdaa",
            "relative_name": "Ramesh Gowda",
            "locality": "Chennapura",
            "age": 30,
            "limit": 1,
        },
    )

    assert response.status_code == 200
    reasons = {
        reason["field"]: reason["match"]
        for reason in response.json()["candidates"][0]["match_reasons"]
    }
    assert reasons["Name"] == "Close match"
    assert reasons["Age"] == "Close match"


@pytest.mark.parametrize(
    "body",
    [
        {
            "name": "ಅನನ್ಯಾ ಗೌಡ",
            "relative_name": "ರಮೇಶ್ ಗೌಡ",
            "locality": "ಚೆನ್ನಾಪುರ",
            "age": 28,
            "limit": 1,
        },
        {
            "name": " Ananya  GOWDA ",
            "relative_name": " Ramesh  GOWDA ",
            "locality": " CHENNAPURA ",
            "age": 28,
            "limit": 1,
        },
    ],
)
def test_exact_native_or_latin_aliases_are_labeled_exact(
    client: TestClient, body: dict[str, object]
) -> None:
    response = client.post("/api/search", json=body)

    assert response.status_code == 200
    assert {
        reason["field"]: reason["match"]
        for reason in response.json()["candidates"][0]["match_reasons"]
    } == {
        "Name": "Exact match",
        "Relative's name": "Exact match",
        "Locality": "Exact match",
        "Age": "Exact match",
    }


def test_no_confident_result_never_exposes_a_candidate_for_verification(client: TestClient) -> None:
    response = client.post(
        "/api/search", json={"name": "Nandini Meridian", "locality": "Imaginary Nagar"}
    )

    assert response.status_code == 200
    assert response.json() == {"state": "no_confident_result", "candidates": []}


def test_ambiguous_kavya_keeps_multiple_plausible_candidates_for_refinement(
    client: TestClient,
) -> None:
    response = client.post("/api/search", json={"name": "Kavya Nayak"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["state"] == "needs_more_detail"
    assert len(payload["candidates"]) >= 2
    assert {candidate["synthetic_id"] for candidate in payload["candidates"]} >= {
        "SYN-KA-C",
        "SYN-KA-K",
    }


def test_api_examples_are_the_exact_manifest_array(client: TestClient) -> None:
    response = client.get("/api/examples")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [
        "exact-kannada",
        "romanized-typo",
        "needs-refinement",
        "no-confident-match",
    ]


def test_demo_records_are_manifest_ordered_and_privacy_safe(client: TestClient) -> None:
    response = client.get("/api/demo/records")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    records = response.json()
    assert len(records) == 120
    assert [record["synthetic_id"] for record in records] == [
        "SYN-KA-A",
        "SYN-KA-B",
        "SYN-KA-C",
        "SYN-KA-D",
        "SYN-KA-E",
        "SYN-KA-F",
        "SYN-KA-G",
        "SYN-KA-H",
        "SYN-KA-I",
        "SYN-KA-J",
        "SYN-KA-K",
        *[f"SYN-KA-{number:03d}" for number in range(12, 121)],
    ]
    assert set(records[0]) == {
        "synthetic_id",
        "name",
        "latin_name",
        "relative_name",
        "latin_relative_name",
        "relationship",
        "locality",
        "latin_locality",
        "age",
        "evidence_id",
        "source_part",
        "source_page",
    }
    assert records[0]["relationship"] == "father"


def test_record_and_health_routes_are_manifest_bound(client: TestClient) -> None:
    record = client.get("/api/records/SYN-KA-A")
    missing = client.get("/api/records/UNKNOWN")
    health = client.get("/healthz")

    assert record.status_code == 200
    assert record.json()["synthetic_id"] == "SYN-KA-A"
    assert missing.status_code == 404
    assert health.status_code == 200
    assert health.json() == {"status": "ready"}
    for response in (record, missing, health):
        assert response.headers["cache-control"] == "no-store"


def test_repeated_concurrent_searches_use_the_verified_snapshot(client: TestClient) -> None:
    def request() -> int:
        return client.post("/api/search", json={"name": "Ananya Gowdaa"}).status_code

    with ThreadPoolExecutor(max_workers=4) as executor:
        statuses = list(executor.map(lambda _: request(), range(12)))

    assert statuses == [200] * 12


def test_public_route_surface_is_allowlisted_and_static_cannot_handle_unknown_api_paths(
    client: TestClient,
) -> None:
    response = client.get("/api/not-a-route")

    assert response.status_code == 404
    assert response.headers["cache-control"] == "no-store"
    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
    assert client.get("/openapi.json").status_code == 404


@pytest.mark.parametrize(
    "path",
    [
        "/api/not-a-route",
        "/api/%2e%2e%2findex.html",
        "/api/%252e%252e%252findex.html",
    ],
)
def test_api_paths_never_fall_through_to_static_assets(tmp_path: Path, path: str) -> None:
    snapshot = tmp_path / "snapshot"
    web_root = tmp_path / "web"
    web_root.mkdir()
    (web_root / "index.html").write_text("<main>synthetic static page</main>", encoding="utf-8")
    build_demo_snapshot(render_demo_source(tmp_path / "source"), snapshot, dense_encoder=_Encoder())
    app = create_app(snapshot / "manifest.json", web_root=web_root, encoder=_Encoder())

    with TestClient(app) as static_client:
        response = static_client.get(path)

    assert response.status_code == 404
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"detail": "not found"}


def test_demo_data_spa_routes_serve_the_root_index_without_capturing_api_paths(
    tmp_path: Path,
) -> None:
    snapshot = tmp_path / "snapshot"
    web_root = tmp_path / "web"
    web_root.mkdir()
    index = b"<main>synthetic static page</main>"
    (web_root / "index.html").write_bytes(index)
    build_demo_snapshot(render_demo_source(tmp_path / "source"), snapshot, dense_encoder=_Encoder())
    app = create_app(snapshot / "manifest.json", web_root=web_root, encoder=_Encoder())

    with TestClient(app) as static_client:
        root = static_client.get("/")
        demo_data = static_client.get("/demo-data")
        demo_data_slash = static_client.get("/demo-data/")
        unknown_api = static_client.get("/api/not-a-route")

    assert root.status_code == demo_data.status_code == demo_data_slash.status_code == 200
    assert demo_data.content == demo_data_slash.content == root.content == index
    assert root.headers["content-type"].startswith("text/html")
    assert demo_data.headers["content-type"].startswith("text/html")
    assert demo_data_slash.headers["content-type"].startswith("text/html")
    assert unknown_api.status_code == 404
    assert unknown_api.headers["cache-control"] == "no-store"
    assert unknown_api.json() == {"detail": "not found"}


def test_unknown_document_route_serves_the_spa_root_but_non_document_routes_remain_not_found(
    tmp_path: Path,
) -> None:
    snapshot = tmp_path / "snapshot"
    web_root = tmp_path / "web"
    web_root.mkdir()
    index = b"<main>synthetic static page</main>"
    (web_root / "index.html").write_bytes(index)
    build_demo_snapshot(render_demo_source(tmp_path / "source"), snapshot, dense_encoder=_Encoder())
    app = create_app(snapshot / "manifest.json", web_root=web_root, encoder=_Encoder())

    with TestClient(app) as static_client:
        document = static_client.get("/stale-shared-route", headers={"accept": "text/html"})
        non_document = static_client.get(
            "/stale-shared-route",
            headers={"accept": "application/json"},
        )
        missing_asset = static_client.get(
            "/missing.js",
            headers={"accept": "text/html", "sec-fetch-dest": "document"},
        )
        non_get = static_client.post("/stale-shared-route")
        bare_api = static_client.get("/api", headers={"accept": "text/html"})
        api_slash = static_client.get("/api/", headers={"accept": "text/html"})

    assert document.status_code == 200
    assert document.content == index
    assert document.headers["content-type"].startswith("text/html")
    assert non_document.status_code == 404
    assert non_document.json() == {"detail": "not found"}
    assert missing_asset.status_code == 404
    assert missing_asset.json() == {"detail": "not found"}
    assert non_get.status_code == 404
    assert non_get.json() == {"detail": "not found"}
    for api_response in (bare_api, api_slash):
        assert api_response.status_code == 404
        assert api_response.headers["cache-control"] == "no-store"
        assert api_response.json() == {"detail": "not found"}


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"name": "   "},
        {"name": "Ananya", "unknown": "value"},
        {"name": "A" * 121},
        {"name": "Ananya", "age": 17},
        {"name": "Ananya", "age": 121},
        {"name": "Ananya", "limit": 0},
        {"name": "Ananya", "limit": 6},
    ],
)
def test_search_rejects_invalid_or_unknown_input_without_echoing_it(
    client: TestClient, body: dict[str, object]
) -> None:
    response = client.post("/api/search", json=body)

    assert response.status_code == 422
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"detail": "invalid request"}
    assert "unknown" not in response.text


@pytest.mark.parametrize(
    "body, headers",
    [
        ("{", {"content-type": "application/json"}),
        ("name=Ananya", {"content-type": "application/x-www-form-urlencoded"}),
    ],
)
def test_search_rejects_malformed_bodies_without_echoing_them(
    client: TestClient, body: str, headers: dict[str, str]
) -> None:
    response = client.post("/api/search", content=body, headers=headers)

    assert response.status_code == 422
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"detail": "invalid request"}
