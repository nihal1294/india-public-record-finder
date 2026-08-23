"""Deterministic confidence contracts for candidate ranking."""

import pytest

from record_finder.search.rank import FieldScores, classify_response, score_fields


def test_field_score_is_weighted_only_by_citizen_supplied_fields() -> None:
    scores = score_fields(name=1.0, relative_name=0.9, locality=None, age=None)
    assert scores.final == pytest.approx(0.9733333333333334)


def test_possible_match_requires_a_corroborating_field_and_margin() -> None:
    scores = FieldScores(name=1.0, relative_name=0.9, locality=None, age=None, final=0.95)
    assert classify_response(scores, next_score=0.8) == "possible_match"
    assert classify_response(scores, next_score=0.9) == "needs_more_detail"
