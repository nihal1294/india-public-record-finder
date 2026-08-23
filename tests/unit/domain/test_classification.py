import pytest
from pydantic import ValidationError

from record_finder.domain.classification import SyntheticDataEnvelope


def test_synthetic_envelope_accepts_declared_fixture() -> None:
    envelope = SyntheticDataEnvelope.model_validate(
        {"schema_version": 1, "data_classification": "synthetic"}
    )
    assert envelope.schema_version == 1


@pytest.mark.parametrize("value", [None, "public", "production"])
def test_synthetic_envelope_rejects_every_other_classification(value: str | None) -> None:
    payload = {"schema_version": 1}
    if value is not None:
        payload["data_classification"] = value
    with pytest.raises(ValidationError):
        SyntheticDataEnvelope.model_validate(payload)
