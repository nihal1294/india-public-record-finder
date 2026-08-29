from __future__ import annotations

import subprocess
from pathlib import Path

import modal

APP_NAME = "india-public-record-finder"
WEB_LABEL = "india-public-record-finder-web"
PORT = 8080
STARTUP_TIMEOUT_SECONDS = 120
CPU_REQUEST = 2.0
MEMORY_REQUEST_MIB = 2048
MIN_CONTAINERS = 0
MAX_CONTAINERS = 1
SCALEDOWN_WINDOW_SECONDS = 300
CONCURRENCY_LIMIT = 16

REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
DOCKERFILE = REPOSITORY_ROOT / "Dockerfile"

SERVICE_COMMAND = [
    "record-finder",
    "serve",
    "--snapshot",
    "/app/data/synthetic/demo-v1/manifest.json",
    "--model-cache",
    "/app/model-cache",
    "--model-manifest",
    "/app/models/manifest.json",
    "--web-root",
    "/app/web",
    "--host",
    "0.0.0.0",
    "--port",
    "8080",
]

image = modal.Image.from_dockerfile(
    DOCKERFILE,
    context_dir=REPOSITORY_ROOT,
).entrypoint([])
app = modal.App(APP_NAME)


@app.function(
    image=image,
    cpu=CPU_REQUEST,
    memory=MEMORY_REQUEST_MIB,
    min_containers=MIN_CONTAINERS,
    max_containers=MAX_CONTAINERS,
    scaledown_window=SCALEDOWN_WINDOW_SECONDS,
)
@modal.concurrent(max_inputs=CONCURRENCY_LIMIT)
@modal.web_server(PORT, startup_timeout=STARTUP_TIMEOUT_SECONDS, label=WEB_LABEL)
def web() -> None:
    subprocess.Popen(SERVICE_COMMAND)
