import hashlib
import json
import sys
import types
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[2]))

from scripts.fetch_models import _promote, _verify_files, fetch


def _manifest(tmp_path: Path) -> Path:
    manifest = {
        "models": {
            "test": {
                "repo_id": "example/test",
                "revision": "a" * 40,
                "cache_directory": "test-model",
                "files": {"weight.bin": "0" * 64},
            }
        }
    }
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    return path


def test_fetch_returns_a_verified_existing_cache_without_mutating_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A usable external cache remains continuously available without a download."""
    destination = tmp_path / "models"
    existing = destination / "test-model"
    existing.mkdir(parents=True)
    (existing / "weight.bin").write_bytes(b"known-good")

    manifest = _manifest(tmp_path)
    payload = json.loads(manifest.read_text(encoding="utf-8"))
    payload["models"]["test"]["files"]["weight.bin"] = hashlib.sha256(b"known-good").hexdigest()
    manifest.write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setitem(sys.modules, "huggingface_hub", types.SimpleNamespace())

    assert fetch("test", destination, manifest) == existing
    assert (existing / "weight.bin").read_bytes() == b"known-good"


def test_fetch_rejects_a_repository_local_destination(tmp_path: Path) -> None:
    """Weights belong only in an operator-selected external cache."""
    with pytest.raises(ValueError, match="outside the repository"):
        fetch("test", Path.cwd() / "models" / "test-cache", _manifest(tmp_path))


def test_fetch_fails_closed_for_an_invalid_existing_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A legacy invalid target is never removed just to attempt a replacement."""
    destination = tmp_path / "models"
    target = destination / "test-model"
    target.mkdir(parents=True)
    (target / "weight.bin").write_bytes(b"invalid-old-cache")
    monkeypatch.setitem(sys.modules, "huggingface_hub", types.SimpleNamespace())

    with pytest.raises(RuntimeError, match="invalid existing model cache"):
        fetch("test", destination, _manifest(tmp_path))

    assert (target / "weight.bin").read_bytes() == b"invalid-old-cache"


def test_promote_publishes_a_version_with_an_atomic_symlink_pointer(tmp_path: Path) -> None:
    """The live cache name is a pointer, never a removed/recreated directory."""
    stage = tmp_path / "stage"
    stage.mkdir()
    (stage / "weight.bin").write_bytes(b"verified")
    target = tmp_path / "models" / "test-model"
    target.parent.mkdir()

    _promote(stage, target)

    assert target.is_symlink()
    assert target.exists()
    assert (target / "weight.bin").read_bytes() == b"verified"


def test_fetch_downloads_only_the_manifest_declared_files(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    manifest = _manifest(tmp_path)
    payload = json.loads(manifest.read_text(encoding="utf-8"))
    contents = b"verified"
    payload["models"]["test"]["files"]["weight.bin"] = hashlib.sha256(contents).hexdigest()
    manifest.write_text(json.dumps(payload), encoding="utf-8")
    captured: dict[str, object] = {}

    class _Api:
        def model_info(self, repo_id: str, revision: str) -> object:
            assert repo_id == "example/test"
            assert revision == "a" * 40
            return types.SimpleNamespace(sha=revision)

    def _download(**kwargs: object) -> None:
        captured.update(kwargs)
        local_dir = kwargs["local_dir"]
        assert isinstance(local_dir, Path)
        local_dir.mkdir()
        (local_dir / "weight.bin").write_bytes(contents)

    monkeypatch.setitem(
        sys.modules,
        "huggingface_hub",
        types.SimpleNamespace(HfApi=_Api, snapshot_download=_download),
    )

    fetch("test", tmp_path / "models", manifest)

    assert captured["allow_patterns"] == ("weight.bin",)


def test_verification_rejects_an_undeclared_downloaded_file(tmp_path: Path) -> None:
    model = tmp_path / "model"
    model.mkdir()
    (model / "weight.bin").write_bytes(b"known-good")
    (model / "unexpected.bin").write_bytes(b"not-declared")

    with pytest.raises(RuntimeError, match="undeclared"):
        _verify_files(model, {"weight.bin": hashlib.sha256(b"known-good").hexdigest()})
