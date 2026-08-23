"""Public normalization contracts for the local search surface."""

from record_finder.search.normalize import normalize


def test_normalize_preserves_kannada_and_normalizes_latin_whitespace() -> None:
    assert normalize("  ಅನನ್ಯಾ   ಗೌಡ  ") == "ಅನನ್ಯಾ ಗೌಡ"
    assert normalize("  AnAnYa\u00a0GOWDA  ") == "ananya gowda"
