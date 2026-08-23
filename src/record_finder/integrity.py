"""Small integrity helpers shared by the read-only service."""

import hashlib
from pathlib import Path


def sha256_path(path: Path) -> str:
    """Return the SHA-256 digest of one declared artifact."""
    return hashlib.sha256(path.read_bytes()).hexdigest()
