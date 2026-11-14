"""Release-candidate contracts that do not require a container engine."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parents[2]


def test_container_recipe_uses_only_the_read_only_service_surface() -> None:
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")

    assert "FROM node:26-bookworm-slim AS web-build" in dockerfile
    assert "RUN npm install --global pnpm@12.5.1 && pnpm install --frozen-lockfile" in dockerfile
    assert "AS python-base" in dockerfile
    assert "FROM python-runtime AS service-build" in dockerfile
    assert "FROM python-runtime AS runtime" in dockerfile
    assert "PYTHON_VERSION=3.14.10" in dockerfile
    assert (
        "PYTHON_SHA256=de414a57119abef52784d8993e341d53aed635fc2b05c2607d9f98a2c5b72032"
        in dockerfile
    )
    assert "sha256sum -c -" in dockerfile
    assert "--enable-shared --without-ensurepip" in dockerfile
    assert "--with-system-libmpdec" in dockerfile
    assert "mpdecimal-dev" in dockerfile
    assert "curl -fsSL --retry 3" in dockerfile
    assert "rm -rf /usr/local/lib/python3.14/ensurepip" in dockerfile
    assert "USER recordfinder" in dockerfile
    assert "chown -R" not in dockerfile
    assert "scripts/fetch_models.py multilingual_e5_small" in dockerfile
    assert "uv sync --frozen --no-dev --no-install-project" in dockerfile
    assert "cp -aL /opt/model-cache/multilingual-e5-small" in dockerfile
    assert "COPY --from=service-build /opt/runtime-model-cache /app/model-cache" in dockerfile
    assert "COPY data/synthetic/demo-v1 /app/data/synthetic/demo-v1" in dockerfile
    assert "COPY --from=web-build /workspace/apps/web/dist /app/web" in dockerfile
    runtime_stage = dockerfile.rsplit("\nFROM ", maxsplit=1)[1]
    assert runtime_stage.splitlines()[0] == "python-runtime AS runtime"
    assert "COPY LICENSE /app/LICENSE" in runtime_stage.splitlines()
    assert 'ENTRYPOINT ["record-finder"]' in dockerfile
    assert '"--snapshot", "/app/data/synthetic/demo-v1/manifest.json"' in dockerfile
    assert '"--model-cache", "/app/model-cache"' in dockerfile
    assert '"--model-manifest", "/app/models/manifest.json"' in dockerfile
    assert '"--web-root", "/app/web"' in dockerfile
    assert "paddle" not in dockerfile.casefold()
    assert "ocr-spike" not in dockerfile
    assert "build-snapshot" not in dockerfile
    assert "generate-benchmark" not in dockerfile
    assert "uvicorn" not in dockerfile
    assert "src/record_finder/ocr" not in dockerfile
    assert "src/record_finder/index/builder.py" not in dockerfile


def test_web_build_bundles_the_kannada_font_without_remote_font_requests() -> None:
    subprocess.run(["pnpm", "web:build"], cwd=ROOT, check=True)

    font = ROOT / "apps/web/dist/fonts/noto-sans-kannada/NotoSansKannada-Regular.ttf"
    license_text = ROOT / "apps/web/dist/fonts/noto-sans-kannada/OFL.txt"
    source_font = ROOT / "apps/web/public/fonts/noto-sans-kannada/NotoSansKannada-Regular.ttf"
    source_license = ROOT / "apps/web/public/fonts/noto-sans-kannada/OFL.txt"
    stylesheet = (ROOT / "apps/web/src/index.css").read_text(encoding="utf-8")
    built_text = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (ROOT / "apps/web/dist").rglob("*")
        if path.suffix in {".css", ".html", ".js"}
    )

    assert font.is_file()
    assert license_text.is_file()
    assert font.read_bytes() == source_font.read_bytes()
    assert license_text.read_bytes() == source_license.read_bytes()
    assert "@font-face" in stylesheet
    assert "fonts/noto-sans-kannada/NotoSansKannada-Regular.ttf" in stylesheet
    assert "font-weight: 400;" in stylesheet
    assert "font-synthesis: weight" in stylesheet
    assert "font-display: swap" in stylesheet
    assert "fonts.googleapis.com" not in stylesheet
    assert "fonts.gstatic.com" not in stylesheet
    assert "fonts.googleapis.com" not in built_text
    assert "fonts.gstatic.com" not in built_text


def test_runtime_command_exposes_only_serving_help() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "record_finder.runtime", "--help"],
        check=True,
        capture_output=True,
        text=True,
    )

    assert "serve" in result.stdout
    assert "ocr" not in result.stdout.casefold()
    assert "build-snapshot" not in result.stdout
