"""Read-only local hybrid search over a verified synthetic snapshot."""

import hashlib
import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Literal, Protocol

import numpy as np

from record_finder.domain.models import SourceReference
from record_finder.index.manifest import SnapshotManifest, verify_snapshot
from record_finder.search.dense import EncoderUnavailable
from record_finder.search.lexical import (
    age_similarity,
    fts_candidates,
    lexical_ranking,
    text_similarity,
)
from record_finder.search.rank import (
    FieldScores,
    ResponseState,
    classify_response,
    reciprocal_rank_fusion,
    score_fields,
)


class QueryEncoder(Protocol):
    available: bool

    def encode_query(self, text: str) -> np.ndarray: ...


@dataclass(frozen=True)
class SearchQuery:
    name: str
    relative_name: str | None = None
    locality: str | None = None
    age: int | None = None
    limit: int = 5

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("name is required")
        if not 1 <= self.limit <= 5:
            raise ValueError("limit must be between one and five")


@dataclass(frozen=True)
class SearchCandidate:
    synthetic_id: str
    name_native: str
    name_latin: str
    relative_name_native: str
    relative_name_latin: str
    locality_native: str
    locality_latin: str
    age: int
    source: SourceReference
    final_score: float
    field_scores: FieldScores
    match_reasons: tuple[str, ...]


@dataclass(frozen=True)
class SearchResponse:
    state: ResponseState
    candidates: tuple[SearchCandidate, ...]
    elapsed_ms: float
    degraded: bool


@dataclass(frozen=True)
class _Record:
    synthetic_id: str
    name_native: str
    name_latin: str
    relative_name_native: str
    relative_name_latin: str
    relationship: str
    locality_native: str
    locality_latin: str
    age: int
    source: SourceReference

    @property
    def aliases(self) -> dict[str, tuple[str, str]]:
        return {
            "name": (self.name_native, self.name_latin),
            "relative_name": (self.relative_name_native, self.relative_name_latin),
            "locality": (self.locality_native, self.locality_latin),
        }


def _query_embedding_text(query: SearchQuery) -> str:
    parts = [query.name]
    if query.relative_name is not None:
        parts.append(query.relative_name)
    if query.locality is not None:
        parts.append(query.locality)
    if query.age is not None:
        parts.append(f"age {query.age}")
    return "; ".join(parts)


def _load_records(database_path: Path) -> tuple[dict[str, _Record], sqlite3.Connection]:
    connection = sqlite3.connect(f"file:{database_path}?mode=ro", uri=True)
    rows = connection.execute(
        "SELECT synthetic_id, name_native, name_latin, relative_name_native, relative_name_latin, "
        "relationship, locality_native, locality_latin, age, source_json "
        "FROM records ORDER BY position"
    ).fetchall()
    records = {
        str(row[0]): _Record(
            synthetic_id=str(row[0]),
            name_native=str(row[1]),
            name_latin=str(row[2]),
            relative_name_native=str(row[3]),
            relative_name_latin=str(row[4]),
            relationship=str(row[5]),
            locality_native=str(row[6]),
            locality_latin=str(row[7]),
            age=int(row[8]),
            source=SourceReference.model_validate_json(str(row[9])),
        )
        for row in rows
    }
    return records, connection


class SearchService:
    """Serve deterministic confidence over lexical/dense local candidate retrieval."""

    def __init__(self, manifest_path: Path, encoder: QueryEncoder | None = None) -> None:
        self.manifest_path = manifest_path
        self.manifest: SnapshotManifest = verify_snapshot(manifest_path)
        self._records, self._connection = _load_records(manifest_path.parent / "records.sqlite3")
        self._encoder = encoder
        self._matrix: np.ndarray | None = None
        if self.manifest.dense_index is not None:
            self._matrix = np.load(
                manifest_path.parent / self.manifest.dense_index.matrix_path,
                mmap_mode="r",
                allow_pickle=False,
            )

    def close(self) -> None:
        self._connection.close()

    def _dense_ranking(self, query: SearchQuery) -> tuple[str, ...] | None:
        if self._encoder is None or self._matrix is None or not self._encoder.available:
            return None
        try:
            vector = self._encoder.encode_query(_query_embedding_text(query))
        except EncoderUnavailable:
            return None
        if vector.shape != (self._matrix.shape[1],):
            return None
        scores = self._matrix @ vector.astype(np.float32, copy=False)
        positions = np.argsort(-scores, kind="stable")[:20]
        return tuple(self.manifest.record_ids[int(position)] for position in positions)

    def _candidate(self, record: _Record, query: SearchQuery) -> SearchCandidate:
        relative = (
            text_similarity(query.relative_name, record.aliases["relative_name"])
            if query.relative_name is not None
            else None
        )
        locality = (
            text_similarity(query.locality, record.aliases["locality"])
            if query.locality is not None
            else None
        )
        age = age_similarity(query.age, record.age) if query.age is not None else None
        scores = score_fields(
            name=text_similarity(query.name, record.aliases["name"]),
            relative_name=relative,
            locality=locality,
            age=age,
        )
        reasons = tuple(
            field
            for field, value in (
                ("name", scores.name),
                ("relative_name", scores.relative_name),
                ("locality", scores.locality),
                ("age", scores.age),
            )
            if value is not None and value >= 0.55
        )
        return SearchCandidate(
            synthetic_id=record.synthetic_id,
            name_native=record.name_native,
            name_latin=record.name_latin,
            relative_name_native=record.relative_name_native,
            relative_name_latin=record.relative_name_latin,
            locality_native=record.locality_native,
            locality_latin=record.locality_latin,
            age=record.age,
            source=record.source,
            final_score=scores.final,
            field_scores=scores,
            match_reasons=reasons,
        )

    def search(self, query: SearchQuery) -> SearchResponse:
        started = perf_counter()
        lexical = lexical_ranking(
            self._records, query, fts_candidates(self._connection, query.name)
        )
        dense = self._dense_ranking(query)
        fused = reciprocal_rank_fusion(lexical, dense or ())
        candidates = [
            self._candidate(self._records[synthetic_id], query) for synthetic_id, _ in fused
        ]
        rrf_scores = dict(fused)
        candidates.sort(
            key=lambda candidate: (
                -candidate.final_score,
                -rrf_scores[candidate.synthetic_id],
                candidate.synthetic_id,
            )
        )
        top = candidates[0] if candidates else None
        next_score = candidates[1].final_score if len(candidates) > 1 else None
        state: ResponseState
        if dense is None:
            state = "limited_search"
        elif top is None:
            state = "no_confident_result"
        else:
            state = classify_response(top.field_scores, next_score=next_score)
        return SearchResponse(
            state=state,
            candidates=tuple(candidates[: query.limit]),
            elapsed_ms=(perf_counter() - started) * 1000,
            degraded=dense is None,
        )


@dataclass(frozen=True)
class SliceMetrics:
    query_count: int
    recall_at_5: float
    top_1_accuracy: float
    possible_match_count: int


@dataclass(frozen=True)
class BenchmarkReport:
    snapshot_manifest_sha256: str
    query_count: int
    slice_metrics: dict[str, SliceMetrics]
    lexical_slice_metrics: dict[str, SliceMetrics]
    overall_recall_at_5: float
    lexical_overall_recall_at_5: float
    latency_p95_ms: float

    @classmethod
    def empty(cls) -> BenchmarkReport:
        return cls("", 0, {}, {}, 0.0, 0.0, 0.0)

    def model_dump(self) -> dict[str, object]:
        gate = benchmark_gate_result(self)
        return {
            "snapshot_manifest_sha256": self.snapshot_manifest_sha256,
            "query_count": self.query_count,
            "slice_metrics": {
                name: {
                    "query_count": metrics.query_count,
                    "recall_at_5": metrics.recall_at_5,
                    "top_1_accuracy": metrics.top_1_accuracy,
                    "possible_match_count": metrics.possible_match_count,
                }
                for name, metrics in self.slice_metrics.items()
            },
            "lexical_slice_metrics": {
                name: {
                    "query_count": metrics.query_count,
                    "recall_at_5": metrics.recall_at_5,
                    "top_1_accuracy": metrics.top_1_accuracy,
                    "possible_match_count": metrics.possible_match_count,
                }
                for name, metrics in self.lexical_slice_metrics.items()
            },
            "overall_recall_at_5": self.overall_recall_at_5,
            "lexical_overall_recall_at_5": self.lexical_overall_recall_at_5,
            "latency_p95_ms": self.latency_p95_ms,
            "gate": {
                "path": gate.path,
                "passed": not gate.errors,
                "components": gate.components,
                "errors": list(gate.errors),
            },
        }


def _slice_metrics(
    by_slice: dict[str, list[tuple[dict[str, object], SearchResponse]]],
) -> tuple[dict[str, SliceMetrics], int, int]:
    metrics: dict[str, SliceMetrics] = {}
    total_positive = 0
    total_recalled = 0
    for name, entries in by_slice.items():
        positives = [item for item in entries if item[0].get("expected_record_id") is not None]
        recalled = sum(
            item[0]["expected_record_id"]
            in {candidate.synthetic_id for candidate in item[1].candidates}
            for item in positives
        )
        top_one = sum(
            bool(item[1].candidates)
            and item[1].candidates[0].synthetic_id == item[0]["expected_record_id"]
            for item in positives
        )
        metrics[name] = SliceMetrics(
            query_count=len(entries),
            recall_at_5=recalled / len(positives) if positives else 1.0,
            top_1_accuracy=top_one / len(positives) if positives else 1.0,
            possible_match_count=sum(item[1].state == "possible_match" for item in entries),
        )
        total_positive += len(positives)
        total_recalled += recalled
    return metrics, total_positive, total_recalled


def run_benchmark(service: SearchService | None, queries_path: Path) -> BenchmarkReport:
    """Execute the immutable six-slice synthetic retrieval benchmark."""
    payload = json.loads(queries_path.read_text(encoding="utf-8"))
    queries = payload.get("queries")
    if not isinstance(queries, list) or len(queries) != 180:
        raise ValueError("benchmark must contain exactly 180 queries")
    required_slices = {
        "exact_kannada",
        "exact_latin",
        "romanization",
        "typo_ocr",
        "common_name_refinement",
        "no_match_near_miss",
    }
    slice_names = [entry.get("slice") for entry in queries if isinstance(entry, dict)]
    correct_slices = set(slice_names) == required_slices
    correct_slice_counts = all(slice_names.count(name) == 30 for name in required_slices)
    if not correct_slices or not correct_slice_counts:
        raise ValueError("benchmark must contain six 30-query slices")
    if service is None:
        raise ValueError("a search service is required for a valid benchmark")
    manifest_digest = hashlib.sha256(service.manifest_path.read_bytes()).hexdigest()
    if payload.get("snapshot_manifest_sha256") != manifest_digest:
        raise ValueError("benchmark snapshot binding mismatch")
    by_slice: dict[str, list[tuple[dict[str, object], SearchResponse]]] = {
        name: [] for name in required_slices
    }
    lexical_service = SearchService(service.manifest_path, encoder=None)
    lexical_by_slice: dict[str, list[tuple[dict[str, object], SearchResponse]]] = {
        name: [] for name in required_slices
    }
    latencies: list[float] = []
    for entry in queries:
        assert isinstance(entry, dict)
        query_payload = entry.get("query")
        if not isinstance(query_payload, dict):
            raise ValueError("benchmark query payload is invalid")
        search_query = SearchQuery(**query_payload)
        response = service.search(search_query)
        by_slice[str(entry["slice"])].append((entry, response))
        lexical_by_slice[str(entry["slice"])].append((entry, lexical_service.search(search_query)))
        latencies.append(response.elapsed_ms)
    lexical_service.close()
    metrics, total_positive, total_recalled = _slice_metrics(by_slice)
    lexical_metrics, lexical_total_positive, lexical_total_recalled = _slice_metrics(
        lexical_by_slice
    )
    return BenchmarkReport(
        snapshot_manifest_sha256=manifest_digest,
        query_count=len(queries),
        slice_metrics=metrics,
        lexical_slice_metrics=lexical_metrics,
        overall_recall_at_5=total_recalled / total_positive,
        lexical_overall_recall_at_5=lexical_total_recalled / lexical_total_positive,
        latency_p95_ms=float(np.percentile(np.asarray(latencies, dtype=np.float32), 95)),
    )


@dataclass(frozen=True)
class BenchmarkGateResult:
    """The comparator path and immutable inputs used for the release decision."""

    path: Literal["improvement", "saturation"]
    components: dict[str, float | int]
    errors: tuple[str, ...]


def _top_one_correct(metrics: SliceMetrics) -> int:
    return round(metrics.top_1_accuracy * metrics.query_count)


def benchmark_gate_result(report: BenchmarkReport) -> BenchmarkGateResult:
    """Apply the approved absolute gates and the appropriate baseline comparator."""
    exact_kannada = report.slice_metrics["exact_kannada"]
    exact_latin = report.slice_metrics["exact_latin"]
    romanization = report.slice_metrics["romanization"]
    typo_ocr = report.slice_metrics["typo_ocr"]
    lexical_exact_kannada = report.lexical_slice_metrics["exact_kannada"]
    lexical_exact_latin = report.lexical_slice_metrics["exact_latin"]
    lexical_romanization = report.lexical_slice_metrics["romanization"]
    lexical_typo_ocr = report.lexical_slice_metrics["typo_ocr"]
    hybrid_robust_correct = _top_one_correct(romanization) + _top_one_correct(typo_ocr)
    lexical_robust_correct = _top_one_correct(lexical_romanization) + _top_one_correct(
        lexical_typo_ocr
    )
    components: dict[str, float | int] = {
        "hybrid_overall_recall_at_5": report.overall_recall_at_5,
        "lexical_overall_recall_at_5": report.lexical_overall_recall_at_5,
        "exact_kannada_top_1_hybrid": exact_kannada.top_1_accuracy,
        "exact_kannada_top_1_lexical": lexical_exact_kannada.top_1_accuracy,
        "exact_latin_top_1_hybrid": exact_latin.top_1_accuracy,
        "exact_latin_top_1_lexical": lexical_exact_latin.top_1_accuracy,
        "combined_robust_top_1_hybrid_correct": hybrid_robust_correct,
        "combined_robust_top_1_lexical_correct": lexical_robust_correct,
        "combined_robust_top_1_query_count": romanization.query_count + typo_ocr.query_count,
    }
    errors: list[str] = []
    if report.overall_recall_at_5 < 0.95:
        errors.append("overall Recall@5 is below 95%")
    for slice_name in ("romanization", "typo_ocr"):
        if report.slice_metrics[slice_name].recall_at_5 < 0.90:
            errors.append(f"{slice_name} Recall@5 is below 90%")
    if report.slice_metrics["no_match_near_miss"].possible_match_count != 0:
        errors.append("a no-match query produced possible_match")
    if report.lexical_overall_recall_at_5 < 0.95:
        path: Literal["improvement", "saturation"] = "improvement"
        if report.overall_recall_at_5 < report.lexical_overall_recall_at_5 + 0.05:
            errors.append(
                "hybrid Recall@5 did not improve lexical retrieval by five percentage points"
            )
    else:
        path = "saturation"
        if report.overall_recall_at_5 < report.lexical_overall_recall_at_5:
            errors.append("hybrid Recall@5 regressed from the saturated lexical baseline")
        if exact_kannada.top_1_accuracy < lexical_exact_kannada.top_1_accuracy:
            errors.append("exact_kannada top-1 regressed from lexical retrieval")
        if exact_latin.top_1_accuracy < lexical_exact_latin.top_1_accuracy:
            errors.append("exact_latin top-1 regressed from lexical retrieval")
        if hybrid_robust_correct < lexical_robust_correct:
            errors.append(
                "combined Romanization and typo/error top-1 regressed from lexical retrieval"
            )
    return BenchmarkGateResult(path=path, components=components, errors=tuple(errors))


def benchmark_acceptance_errors(report: BenchmarkReport) -> tuple[str, ...]:
    """Compatibility wrapper for callers that need only failed acceptance gates."""
    return benchmark_gate_result(report).errors
