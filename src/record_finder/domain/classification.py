"""Synthetic-data classification boundaries."""

from typing import Literal

from pydantic import BaseModel, ConfigDict


class SyntheticDataEnvelope(BaseModel):
    """A payload explicitly declared as an approved synthetic fixture."""

    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1]
    data_classification: Literal["synthetic"]
