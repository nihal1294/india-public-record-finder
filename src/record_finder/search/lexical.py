"""SQLite FTS and local character matching candidate retrieval."""

import sqlite3
from collections.abc import Mapping

from rapidfuzz.fuzz import ratio

from record_finder.search.normalize import normalize

_TEXT_FIELDS = ("name", "relative_name", "locality")


def text_similarity(query: str, aliases: tuple[str, str]) -> float:
    """Return the highest local character similarity across native and Latin aliases."""
    normalized_query = normalize(query)
    return max(ratio(normalized_query, normalize(alias)) / 100.0 for alias in aliases)


def age_similarity(query_age: int, record_age: int) -> float:
    difference = abs(query_age - record_age)
    if difference <= 2:
        return 1.0
    if difference <= 5:
        return 0.5
    return 0.0


def fts_candidates(connection: sqlite3.Connection, name: str, limit: int = 20) -> tuple[str, ...]:
    """Use only normalized input tokens in FTS, falling back safely for malformed terms."""
    terms = [term for term in normalize(name).split() if term]
    if not terms:
        return ()
    expression = " OR ".join(f'"{term.replace(chr(34), "")}"' for term in terms)
    try:
        rows = connection.execute(
            "SELECT records.synthetic_id FROM records_fts JOIN records "
            "ON records_fts.rowid = records.position WHERE records_fts MATCH ? "
            "ORDER BY bm25(records_fts) LIMIT ?",
            (expression, limit),
        ).fetchall()
    except sqlite3.Error:
        return ()
    return tuple(str(row[0]) for row in rows)


def lexical_ranking(
    records: Mapping[str, object],
    query: object,
    fts_ids: tuple[str, ...],
    limit: int = 20,
) -> tuple[str, ...]:
    """Rank all verified records deterministically using local FTS and fuzzy similarity."""
    fts_bonus = {
        synthetic_id: len(fts_ids) - position for position, synthetic_id in enumerate(fts_ids)
    }
    values: list[tuple[str, float]] = []
    for synthetic_id, record in records.items():
        aliases = getattr(record, "aliases")
        age = getattr(record, "age")
        name_score = text_similarity(getattr(query, "name"), aliases["name"])
        parts = [name_score]
        for field in _TEXT_FIELDS[1:]:
            value = getattr(query, field)
            if value is not None:
                parts.append(text_similarity(value, aliases[field]))
        query_age = getattr(query, "age")
        if query_age is not None:
            parts.append(age_similarity(query_age, age))
        fuzzy = sum(parts) / len(parts)
        values.append((synthetic_id, fuzzy + fts_bonus.get(synthetic_id, 0) / 1000.0))
    ordered = sorted(values, key=lambda item: (-item[1], item[0]))[:limit]
    return tuple(synthetic_id for synthetic_id, _ in ordered)
