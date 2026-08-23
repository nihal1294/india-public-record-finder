"""The fixed synthetic retrieval benchmark contract."""

from record_finder.search.service import (
    BenchmarkReport,
    SliceMetrics,
    benchmark_gate_result,
    run_benchmark,
)


def test_benchmark_report_rejects_non_180_query_sets(tmp_path) -> None:  # type: ignore[no-untyped-def]
    queries = tmp_path / "queries.json"
    queries.write_text('{"queries": []}', encoding="utf-8")
    try:
        run_benchmark(None, queries)
    except ValueError as error:
        assert "180" in str(error)
    else:
        raise AssertionError("the fixed benchmark must reject a partial query set")


def test_benchmark_report_has_slice_metrics() -> None:
    report = BenchmarkReport.empty()
    assert report.slice_metrics == {}


def _slice(top_1_accuracy: float = 1.0) -> SliceMetrics:
    return SliceMetrics(
        query_count=30,
        recall_at_5=1.0,
        top_1_accuracy=top_1_accuracy,
        possible_match_count=0,
    )


def test_saturated_lexical_baseline_uses_non_regression_and_combined_top_one() -> None:
    hybrid = {
        "exact_kannada": _slice(),
        "exact_latin": _slice(),
        "romanization": _slice(22 / 30),
        "typo_ocr": _slice(15 / 30),
        "common_name_refinement": _slice(),
        "no_match_near_miss": _slice(),
    }
    lexical = {
        "exact_kannada": _slice(),
        "exact_latin": _slice(),
        "romanization": _slice(24 / 30),
        "typo_ocr": _slice(12 / 30),
        "common_name_refinement": _slice(),
        "no_match_near_miss": _slice(),
    }
    report = BenchmarkReport("digest", 180, hybrid, lexical, 1.0, 1.0, 13.6)

    result = benchmark_gate_result(report)

    assert result.path == "saturation"
    assert result.errors == ()
    assert result.components["combined_robust_top_1_hybrid_correct"] == 37
    assert result.components["combined_robust_top_1_lexical_correct"] == 36


def test_unsaturated_lexical_baseline_keeps_the_five_point_improvement_rule() -> None:
    metrics = {
        "exact_kannada": _slice(),
        "exact_latin": _slice(),
        "romanization": _slice(),
        "typo_ocr": _slice(),
        "common_name_refinement": _slice(),
        "no_match_near_miss": _slice(),
    }
    report = BenchmarkReport("digest", 180, metrics, metrics, 0.96, 0.93, 13.6)

    result = benchmark_gate_result(report)

    assert result.path == "improvement"
    assert "five percentage points" in result.errors[0]
