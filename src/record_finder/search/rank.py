"""Deterministic field scoring; retrieval scores never become confidence scores."""

from dataclasses import dataclass
from typing import Literal

ResponseState = Literal[
    "possible_match", "needs_more_detail", "no_confident_result", "limited_search"
]


@dataclass(frozen=True)
class FieldScores:
    name: float
    relative_name: float | None
    locality: float | None
    age: float | None
    final: float


_WEIGHTS = {"name": 0.55, "relative_name": 0.20, "locality": 0.15, "age": 0.10}


def score_fields(
    *, name: float, relative_name: float | None, locality: float | None, age: float | None
) -> FieldScores:
    """Normalize fixed field weights over exactly the supplied search fields."""
    supplied = {
        "name": name,
        "relative_name": relative_name,
        "locality": locality,
        "age": age,
    }
    denominator = sum(_WEIGHTS[field] for field, score in supplied.items() if score is not None)
    if denominator == 0:
        raise ValueError("a query must include a name")
    final = (
        sum(_WEIGHTS[field] * score for field, score in supplied.items() if score is not None)
        / denominator
    )
    return FieldScores(
        name=name,
        relative_name=relative_name,
        locality=locality,
        age=age,
        final=final,
    )


def classify_response(scores: FieldScores, *, next_score: float | None) -> ResponseState:
    """Classify a candidate solely from deterministic field comparisons."""
    corroborates = any(
        value is not None and value >= 0.85 for value in (scores.relative_name, scores.locality)
    )
    margin = scores.final - (next_score if next_score is not None else 0.0)
    if scores.final >= 0.80 and scores.name >= 0.85 and corroborates and margin >= 0.10:
        return "possible_match"
    if scores.final >= 0.55:
        return "needs_more_detail"
    return "no_confident_result"


def reciprocal_rank_fusion(
    *rankings: tuple[str, ...], k: int = 60, limit: int = 20
) -> tuple[tuple[str, float], ...]:
    """Fuse bounded lexical/dense rankings without inspecting their score scales."""
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, synthetic_id in enumerate(ranking, start=1):
            scores[synthetic_id] = scores.get(synthetic_id, 0.0) + 1.0 / (k + rank)
    return tuple(sorted(scores.items(), key=lambda item: (-item[1], item[0]))[:limit])
