"""Strict, browser-facing API contracts."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class SearchRequest(_StrictModel):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    relative_name: Annotated[str | None, Field(min_length=1, max_length=120)] = None
    locality: Annotated[str | None, Field(min_length=1, max_length=120)] = None
    age: Annotated[int | None, Field(ge=18, le=120)] = None
    limit: Annotated[int, Field(ge=1, le=5)] = 5

    @field_validator("name", "relative_name", "locality", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class MatchReason(_StrictModel):
    field: str
    value: str
    match: str


class SearchCandidate(_StrictModel):
    synthetic_id: str
    name: str
    latin_name: str
    relative_name: str
    locality: str
    age: int
    evidence_id: str
    source_part: str
    source_page: int
    match_reasons: list[MatchReason]


class SearchResponse(_StrictModel):
    state: Literal["possible_match", "needs_more_detail", "no_confident_result", "limited_search"]
    candidates: list[SearchCandidate]


class RecordResponse(_StrictModel):
    synthetic_id: str
    name: str
    latin_name: str
    relative_name: str
    locality: str
    age: int
    evidence_id: str
    source_part: str
    source_page: int


class HealthResponse(_StrictModel):
    status: Literal["ready", "unavailable"]
