"""Small extension seams for the fixed Karnataka synthetic collection."""

from typing import Protocol

from record_finder.domain.models import PublicRecord


class SearchProfile(Protocol):
    def searchable_fields(self, record: PublicRecord) -> dict[str, tuple[str, ...]]: ...


class StateAdapter(Protocol):
    @property
    def template_id(self) -> str: ...

    @property
    def field_geometry(self) -> dict[str, tuple[int, int, int, int]]: ...

    def aliases(self, value: str) -> tuple[str, ...]: ...

    def searchable_fields(self, record: PublicRecord) -> dict[str, tuple[str, ...]]: ...
