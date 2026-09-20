from __future__ import annotations

import ast
import os
import re
import subprocess
import tomllib
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DRIVER = REPOSITORY_ROOT / "deploy" / "modal_app.py"
DEPLOYED_PLAYWRIGHT_CONFIG = REPOSITORY_ROOT / "apps" / "web" / "playwright.deployed.config.ts"
RELEASE_JOURNEY = REPOSITORY_ROOT / "e2e" / "release-api.spec.ts"


def _project() -> dict[str, object]:
    return tomllib.loads((REPOSITORY_ROOT / "pyproject.toml").read_text())


def _driver_module() -> ast.Module:
    return ast.parse(DRIVER.read_text())


def _call_keywords(call: ast.Call) -> dict[str, ast.expr]:
    return {keyword.arg: keyword.value for keyword in call.keywords if keyword.arg is not None}


def _literal(node: ast.expr) -> object:
    return ast.literal_eval(node)


def _assignment_literal(assignments: dict[str, ast.expr], node: ast.expr) -> object:
    assert isinstance(node, ast.Name)
    return _literal(assignments[node.id])


def _list_deployed_tests(base_url: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            "pnpm",
            "--dir",
            "apps/web",
            "exec",
            "playwright",
            "test",
            "-c",
            "playwright.deployed.config.ts",
            "--list",
        ],
        cwd=REPOSITORY_ROOT,
        env={**os.environ, "RECORD_FINDER_DEPLOYED_BASE_URL": base_url},
        capture_output=True,
        check=False,
        text=True,
    )


def test_modal_is_a_pinned_deploy_only_dependency() -> None:
    project = _project()
    dependencies = project["project"]
    assert isinstance(dependencies, dict)
    runtime = dependencies["dependencies"]
    assert isinstance(runtime, list)
    assert all(not str(dependency).startswith("modal") for dependency in runtime)

    groups = project["dependency-groups"]
    assert isinstance(groups, dict)
    deploy = groups["deploy"]
    assert isinstance(deploy, list)
    assert len(deploy) == 1
    assert re.fullmatch(r"modal==\d+\.\d+\.\d+", str(deploy[0]))


def test_modal_driver_declares_the_reviewed_container_and_web_function_contract() -> None:
    module = _driver_module()
    assignments = {
        target.id: value
        for statement in module.body
        if isinstance(statement, ast.Assign)
        for target in statement.targets
        if isinstance(target, ast.Name)
        for value in [statement.value]
    }
    assert _literal(assignments["APP_NAME"]) == "india-public-record-finder"
    assert _literal(assignments["WEB_LABEL"]) == "india-public-record-finder-web"
    assert _literal(assignments["PORT"]) == 8080
    assert _literal(assignments["STARTUP_TIMEOUT_SECONDS"]) == 120
    assert _literal(assignments["CPU_REQUEST"]) == 2.0
    assert _literal(assignments["MEMORY_REQUEST_MIB"]) == 2048
    assert _literal(assignments["MIN_CONTAINERS"]) == 0
    assert _literal(assignments["MAX_CONTAINERS"]) == 1
    assert _literal(assignments["SCALEDOWN_WINDOW_SECONDS"]) <= 300
    assert _literal(assignments["CONCURRENCY_LIMIT"]) > 0

    calls = [node for node in ast.walk(module) if isinstance(node, ast.Call)]
    image_call = next(
        call
        for call in calls
        if isinstance(call.func, ast.Attribute) and call.func.attr == "from_dockerfile"
    )
    assert isinstance(image_call.func.value, ast.Attribute)
    assert image_call.func.value.attr == "Image"
    image_keywords = _call_keywords(image_call)
    assert isinstance(image_call.args[0], ast.Name)
    assert image_call.args[0].id == "DOCKERFILE"
    assert isinstance(image_keywords["context_dir"], ast.Name)
    assert image_keywords["context_dir"].id == "REPOSITORY_ROOT"

    app_call = next(
        call for call in calls if isinstance(call.func, ast.Attribute) and call.func.attr == "App"
    )
    assert isinstance(app_call.args[0], ast.Name)
    assert app_call.args[0].id == "APP_NAME"

    web_server_call = next(
        call
        for call in calls
        if isinstance(call.func, ast.Attribute) and call.func.attr == "web_server"
    )
    assert isinstance(web_server_call.args[0], ast.Name)
    assert web_server_call.args[0].id == "PORT"
    web_server_keywords = _call_keywords(web_server_call)
    assert isinstance(web_server_keywords["startup_timeout"], ast.Name)
    assert web_server_keywords["startup_timeout"].id == "STARTUP_TIMEOUT_SECONDS"
    assert isinstance(web_server_keywords["label"], ast.Name)
    assert web_server_keywords["label"].id == "WEB_LABEL"
    assert "custom_domains" not in web_server_keywords

    function = next(
        node for node in module.body if isinstance(node, ast.FunctionDef) and node.name == "web"
    )
    function_decorator = next(
        decorator
        for decorator in function.decorator_list
        if isinstance(decorator, ast.Call)
        and isinstance(decorator.func, ast.Attribute)
        and decorator.func.attr == "function"
    )
    function_keywords = _call_keywords(function_decorator)
    assert isinstance(function_keywords["image"], ast.Name)
    assert function_keywords["image"].id == "image"
    assert _assignment_literal(assignments, function_keywords["cpu"]) == 2.0
    assert _assignment_literal(assignments, function_keywords["memory"]) == 2048
    assert _assignment_literal(assignments, function_keywords["min_containers"]) == 0
    assert _assignment_literal(assignments, function_keywords["max_containers"]) == 1
    assert _assignment_literal(assignments, function_keywords["scaledown_window"]) <= 300
    assert "concurrency_limit" not in function_keywords
    assert "gpu" not in function_keywords
    assert "secrets" not in function_keywords
    assert "volumes" not in function_keywords

    concurrency_decorator = next(
        decorator
        for decorator in function.decorator_list
        if isinstance(decorator, ast.Call)
        and isinstance(decorator.func, ast.Attribute)
        and decorator.func.attr == "concurrent"
    )
    concurrency_keywords = _call_keywords(concurrency_decorator)
    assert _assignment_literal(assignments, concurrency_keywords["max_inputs"]) > 0


def test_modal_driver_runs_the_dockerfile_service_command_without_a_shell() -> None:
    module = _driver_module()
    assignments = {
        target.id: value
        for statement in module.body
        if isinstance(statement, ast.Assign)
        for target in statement.targets
        if isinstance(target, ast.Name)
        for value in [statement.value]
    }
    command = _literal(assignments["SERVICE_COMMAND"])
    assert command == [
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

    popen_calls = [
        call
        for call in ast.walk(module)
        if isinstance(call, ast.Call)
        and isinstance(call.func, ast.Attribute)
        and isinstance(call.func.value, ast.Name)
        and call.func.value.id == "subprocess"
        and call.func.attr == "Popen"
    ]
    assert len(popen_calls) == 1
    popen = popen_calls[0]
    assert isinstance(popen.args[0], ast.Name)
    assert popen.args[0].id == "SERVICE_COMMAND"
    assert "shell" not in _call_keywords(popen)


def test_modal_driver_clears_the_docker_entrypoint_before_modal_starts_its_runner() -> None:
    module = _driver_module()
    image_assignment = next(
        statement
        for statement in module.body
        if isinstance(statement, ast.Assign)
        and any(
            isinstance(target, ast.Name) and target.id == "image" for target in statement.targets
        )
    )

    image_value = image_assignment.value
    assert isinstance(image_value, ast.Call)
    assert isinstance(image_value.func, ast.Attribute)
    assert image_value.func.attr == "entrypoint"
    assert len(image_value.args) == 1
    assert _literal(image_value.args[0]) == []

    dockerfile_image = image_value.func.value
    assert isinstance(dockerfile_image, ast.Call)
    assert isinstance(dockerfile_image.func, ast.Attribute)
    assert dockerfile_image.func.attr == "from_dockerfile"


def test_docker_runtime_does_not_install_deploy_tooling() -> None:
    dockerfile = (REPOSITORY_ROOT / "Dockerfile").read_text()
    assert "uv sync --frozen --no-dev --no-install-project" in dockerfile
    assert "--group deploy" not in dockerfile
    assert "modal" not in dockerfile.lower()


def test_generated_modal_hostname_uses_the_required_double_hyphen_separator() -> None:
    generated_hostname = "workspace--india-public-record-finder-web.modal.run"
    assert generated_hostname.endswith("--india-public-record-finder-web.modal.run")


def test_deployed_playwright_config_requires_a_clean_public_https_origin() -> None:
    config = DEPLOYED_PLAYWRIGHT_CONFIG.read_text()
    assert "RECORD_FINDER_DEPLOYED_BASE_URL" in config
    assert "https:" in config
    assert "url.username" in config
    assert "url.password" in config
    assert "url.search" in config
    assert "url.hash" in config
    assert "isIP" in config
    assert "publicDnsHostname" in config
    assert "release-api.spec.ts" in config
    assert "webServer" not in config
    assert "/tmp/" not in config


def test_deployed_playwright_config_accepts_only_a_public_dns_https_origin() -> None:
    accepted = _list_deployed_tests("https://example.com")
    assert accepted.returncode == 0, accepted.stderr
    assert "release-api.spec.ts" in accepted.stdout

    for rejected_url in (
        "https://10.0.0.1",
        "https://169.254.169.254",
        "https://192.168.1.1",
        "https://127.0.0.1",
        "https://0.0.0.0",
        "https://[::1]",
        "https://[::ffff:127.0.0.1]",
        "https://[fc00::1]",
        "https://[fe80::1]",
        "https://localhost",
        "https://service.localhost",
    ):
        rejected = _list_deployed_tests(rejected_url)
        assert rejected.returncode != 0, rejected_url
        assert "clean public HTTPS origin" in rejected.stderr


def test_release_browser_journey_asserts_clean_paths_without_a_localhost_origin() -> None:
    release_journey = RELEASE_JOURNEY.read_text()
    assert "127.0.0.1:8766" not in release_journey
    assert "pathname" in release_journey
    assert "url.search" in release_journey
    assert "url.hash" in release_journey


def test_deployed_release_journey_covers_ready_health_and_both_icons() -> None:
    release_journey = RELEASE_JOURNEY.read_text()
    assert "request.get('/healthz')" in release_journey
    assert "'ready'" in release_journey
    assert "cache-control" in release_journey
    assert 'link[rel="icon"]' in release_journey
    assert 'link[rel="apple-touch-icon"]' in release_journey
    assert "same-origin" in release_journey
    assert "image/svg+xml" in release_journey
    assert "image/png" in release_journey


def test_document_declares_the_icon_metadata_the_deployed_suite_requires() -> None:
    document = (REPOSITORY_ROOT / "apps" / "web" / "index.html").read_text()
    assert '<link rel="icon" type="image/svg+xml" sizes="any" href="/favicon.svg" />' in document
    assert (
        '<link rel="apple-touch-icon" type="image/png" sizes="180x180" '
        'href="/apple-touch-icon.png" />'
    ) in document


def test_deploy_commands_and_disclosure_are_origin_neutral() -> None:
    readme = (REPOSITORY_ROOT / "README.md").read_text()
    assert "uv run --group deploy modal deploy deploy/modal_app.py" in readme
    assert "RECORD_FINDER_DEPLOYED_BASE_URL=https://" in readme
    assert "--strategy rolling" in readme
    assert "--tag <full-commit-sha>" in readme
    assert "current deployment" not in readme.lower()

    disclosure = (REPOSITORY_ROOT / "submission" / "third-party-components.md").read_text()
    assert "deploy-only tooling" in disclosure.lower()
