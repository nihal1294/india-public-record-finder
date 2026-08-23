"""Ephemeral API privacy controls."""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from time import monotonic


@dataclass(frozen=True)
class _Bucket:
    started_at: float
    count: int


class EphemeralRateLimiter:
    """Keep only opaque, short-lived request counters in process memory."""

    def __init__(
        self, *, max_requests: int = 30, window_seconds: float = 60.0, max_buckets: int = 1024
    ) -> None:
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._max_buckets = max_buckets
        self._salt = secrets.token_bytes(32)
        self._buckets: dict[str, _Bucket] = {}

    def _key(self, client_host: str) -> str:
        return hmac.new(self._salt, client_host.encode("utf-8"), hashlib.sha256).hexdigest()

    def allow(self, client_host: str) -> bool:
        now = monotonic()
        self._buckets = {
            key: bucket
            for key, bucket in self._buckets.items()
            if now - bucket.started_at < self._window_seconds
        }
        key = self._key(client_host)
        bucket = self._buckets.get(key)
        if bucket is None:
            if len(self._buckets) >= self._max_buckets:
                oldest_key = min(
                    self._buckets, key=lambda item: (self._buckets[item].started_at, item)
                )
                del self._buckets[oldest_key]
            self._buckets[key] = _Bucket(started_at=now, count=1)
            return True
        if bucket.count >= self._max_requests:
            return False
        self._buckets[key] = _Bucket(started_at=bucket.started_at, count=bucket.count + 1)
        return True

    def bucket_keys(self) -> tuple[str, ...]:
        """Return the opaque in-memory bucket identifiers."""
        return tuple(self._buckets)
