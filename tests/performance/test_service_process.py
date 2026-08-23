"""A model-gated, process-level readiness and memory measurement."""

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).parents[2]


def _free_loopback_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        return int(listener.getsockname()[1])


def _rss_mib(process_id: int) -> float:
    status = Path(f"/proc/{process_id}/status")
    if status.is_file():
        for line in status.read_text(encoding="utf-8").splitlines():
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) / 1024
    result = subprocess.run(
        ["ps", "-o", "rss=", "-p", str(process_id)],
        check=True,
        capture_output=True,
        text=True,
    )
    return int(result.stdout.strip()) / 1024


@unittest.skipUnless(
    os.environ.get("RECORD_FINDER_TEST_MODEL_CACHE"),
    "requires an operator-provided verified E5 cache",
)
class ServiceProcessMeasurementTests(unittest.TestCase):
    def test_service_process_becomes_ready_and_searches_the_synthetic_snapshot(self) -> None:
        model_cache = Path(os.environ["RECORD_FINDER_TEST_MODEL_CACHE"])
        port = _free_loopback_port()
        with tempfile.TemporaryDirectory() as temporary:
            web_root = Path(temporary) / "web"
            web_root.mkdir()
            (web_root / "index.html").write_text("<main>Record Finder</main>", encoding="utf-8")
            command = [
                sys.executable,
                "-m",
                "record_finder.runtime",
                "serve",
                "--snapshot",
                str(ROOT / "data/synthetic/demo-v1/manifest.json"),
                "--model-cache",
                str(model_cache),
                "--model-manifest",
                str(ROOT / "models/manifest.json"),
                "--web-root",
                str(web_root),
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ]
            started = time.perf_counter()
            process = subprocess.Popen(
                command, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            try:
                deadline = started + 30
                while True:
                    try:
                        with urlopen(f"http://127.0.0.1:{port}/healthz", timeout=0.25) as response:
                            ready = json.loads(response.read())
                        if ready == {"status": "ready"}:
                            break
                    except OSError:
                        pass
                    if time.perf_counter() >= deadline:
                        self.fail("service did not become ready")
                    time.sleep(0.05)
                cold_ready_ms = (time.perf_counter() - started) * 1000
                request = Request(
                    f"http://127.0.0.1:{port}/api/search",
                    data=json.dumps(
                        {
                            "name": "Ananya Gowdaa",
                            "relative_name": "Ramesh Gowda",
                            "locality": "Chennapura",
                            "age": 28,
                        }
                    ).encode(),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(request, timeout=5) as response:
                    payload = json.loads(response.read())
                self.assertEqual(payload["state"], "possible_match")
                self.assertEqual(payload["candidates"][0]["synthetic_id"], "SYN-KA-A")
                print(
                    f"service_cold_ready_ms={cold_ready_ms:.3f} "
                    f"service_steady_rss_mib={_rss_mib(process.pid):.2f}"
                )
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
