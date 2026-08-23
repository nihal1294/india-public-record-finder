"""Snapshot-backed retrieval behaviour."""

import numpy as np
import pytest

from record_finder.index.builder import build_demo_snapshot
from record_finder.search.service import SearchQuery, SearchService
from record_finder.synthetic.render import render_demo_source


class _LocalTestEncoder:
    available = True
    model_key = "multilingual_e5_small"
    repo_id = "intfloat/multilingual-e5-small"
    revision = "614241f622f53c4eeff9890bdc4f31cfecc418b3"
    dimensions = 384

    def encode_records(self, texts: list[str]) -> np.ndarray:
        matrix = np.zeros((len(texts), 384), dtype=np.float32)
        matrix[:, 0] = 1.0
        return matrix

    def encode_query(self, text: str) -> np.ndarray:
        vector = np.zeros(384, dtype=np.float32)
        vector[0] = 1.0
        return vector


@pytest.fixture()
def service(tmp_path):  # type: ignore[no-untyped-def]
    snapshot = tmp_path / "snapshot"
    build_demo_snapshot(
        render_demo_source(tmp_path / "source"), snapshot, dense_encoder=_LocalTestEncoder()
    )
    return SearchService(snapshot / "manifest.json", encoder=_LocalTestEncoder())


def test_romanized_typo_recovers_ananya_from_local_aliases(service: SearchService) -> None:
    response = service.search(
        SearchQuery(
            name="Ananya Gowdaa",
            relative_name="Ramesh Gowda",
            locality="Chennapura",
            age=28,
        )
    )
    assert response.state == "possible_match"
    assert response.candidates[0].synthetic_id == "SYN-KA-A"


def test_ambiguous_name_requires_refinement(service: SearchService) -> None:
    response = service.search(SearchQuery(name="Kavya Nayak"))
    assert response.state == "needs_more_detail"
    assert len(response.candidates) >= 2


def test_absent_encoder_is_explicitly_limited_search(service: SearchService) -> None:
    lexical_service = SearchService(service.manifest_path, encoder=None)
    response = lexical_service.search(SearchQuery(name="Ananya Gowda"))
    assert response.state == "limited_search"
