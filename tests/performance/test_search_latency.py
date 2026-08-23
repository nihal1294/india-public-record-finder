"""Warm release-search latency contract for the verified demo snapshot."""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter

import numpy as np
import pytest

from record_finder.search.dense import LocalE5Encoder
from record_finder.search.service import SearchQuery, SearchService


@dataclass(frozen=True)
class LatencyReport:
    sample_count: int
    p50_ms: float
    p95_ms: float


def _model_cache() -> Path:
    value = os.environ.get("RECORD_FINDER_TEST_MODEL_CACHE")
    if value is None:
        pytest.skip("RECORD_FINDER_TEST_MODEL_CACHE is required for the release latency check")
    return Path(value)


def _queries() -> list[SearchQuery]:
    payload = json.loads(Path("benchmarks/queries.json").read_text(encoding="utf-8"))
    return [SearchQuery(**entry["query"]) for entry in payload["queries"]]


def measure_search_latency(
    service: SearchService, queries: list[SearchQuery], *, warmup_count: int, repetitions: int
) -> LatencyReport:
    for query in queries[:warmup_count]:
        service.search(query)
    samples: list[float] = []
    for _ in range(repetitions):
        for query in queries:
            started = perf_counter()
            service.search(query)
            samples.append((perf_counter() - started) * 1000)
    return LatencyReport(
        sample_count=len(samples),
        p50_ms=float(np.percentile(np.asarray(samples, dtype=np.float64), 50)),
        p95_ms=float(np.percentile(np.asarray(samples, dtype=np.float64), 95)),
    )


def test_warm_search_p95_is_below_300ms() -> None:
    cache = _model_cache()
    encoder = LocalE5Encoder(cache / "multilingual-e5-small", Path("models/manifest.json"))
    service = SearchService(Path("data/synthetic/demo-v1/manifest.json"), encoder=encoder)
    try:
        report = measure_search_latency(service, _queries(), warmup_count=20, repetitions=5)
    finally:
        service.close()

    print(
        f"warm_samples={report.sample_count} warm_p50_ms={report.p50_ms:.3f} "
        f"warm_p95_ms={report.p95_ms:.3f}"
    )
    assert report.sample_count == 900
    assert report.p95_ms < 300
