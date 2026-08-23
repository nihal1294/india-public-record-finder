"""Fetch one manifest-pinned model into an operator-selected cache root."""

import argparse
import hashlib
import json
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import Any


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _manifest(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _verify_files(directory: Path, files: dict[str, str]) -> None:
    actual = {
        path.relative_to(directory).as_posix() for path in directory.rglob("*") if path.is_file()
    }
    if actual != set(files):
        raise RuntimeError("download includes undeclared model files")
    for relative, expected in files.items():
        actual_path = directory / relative
        if not actual_path.is_file() or _sha256(actual_path) != expected:
            raise RuntimeError(f"digest verification failed: {relative}")


def _require_external_destination(destination: Path) -> Path:
    resolved = destination.resolve()
    repository_root = Path(__file__).resolve().parents[1]
    if resolved.is_relative_to(repository_root):
        raise ValueError("model destination must be outside the repository")
    return resolved


def _promote(stage: Path, target: Path) -> None:
    """Publish a new immutable cache version through one atomic symlink swap."""
    if target.exists() or target.is_symlink():
        raise RuntimeError("model cache pointer already exists")
    versions = target.parent / ".model-versions" / target.name
    versions.mkdir(parents=True, exist_ok=True)
    version = versions / uuid.uuid4().hex
    stage.replace(version)
    pointer = target.parent / f".{target.name}.next-{uuid.uuid4().hex}"
    pointer.symlink_to(version.relative_to(target.parent), target_is_directory=True)
    pointer.replace(target)


def fetch(key: str, destination: Path, manifest_path: Path) -> Path:
    """Verify the hub revision, then atomically promote one complete model."""
    destination = _require_external_destination(destination)
    entry = _manifest(manifest_path)["models"].get(key)
    if entry is None:
        raise ValueError(f"unknown model key: {key}")
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / entry["cache_directory"]
    if target.exists() or target.is_symlink():
        if not target.is_dir():
            raise RuntimeError("invalid existing model cache pointer")
        try:
            _verify_files(target, entry["files"])
        except RuntimeError as error:
            raise RuntimeError("invalid existing model cache; refusing to replace it") from error
        return target

    from huggingface_hub import HfApi, snapshot_download

    info = HfApi().model_info(entry["repo_id"], revision=entry["revision"])
    if info.sha != entry["revision"]:
        raise RuntimeError("Hub did not report the manifest-pinned revision")
    with tempfile.TemporaryDirectory(dir=destination, prefix="model-stage-") as temporary:
        stage = Path(temporary) / entry["cache_directory"]
        snapshot_download(
            repo_id=entry["repo_id"],
            revision=entry["revision"],
            local_dir=stage,
            local_files_only=False,
            allow_patterns=tuple(entry["files"]),
        )
        shutil.rmtree(stage / ".cache", ignore_errors=True)
        _verify_files(stage, entry["files"])
        _promote(stage, target)
    return target


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("key")
    parser.add_argument("--destination", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, default=Path("models/manifest.json"))
    arguments = parser.parse_args()
    print(fetch(arguments.key, arguments.destination, arguments.manifest))


if __name__ == "__main__":
    main()
