"""Minimal production entry point for the read-only record-finder service."""

from pathlib import Path

import typer

app = typer.Typer(add_completion=False, invoke_without_command=True)


@app.callback()
def main() -> None:
    """Run the read-only record-finder service."""


@app.command("serve")
def serve(
    snapshot: Path = typer.Option(..., file_okay=True),
    model_cache: Path = typer.Option(..., file_okay=False),
    model_manifest: Path = typer.Option(..., file_okay=True),
    host: str = typer.Option("0.0.0.0"),
    port: int = typer.Option(8080, min=1, max=65535),
    web_root: Path = typer.Option(..., file_okay=False),
) -> None:
    """Serve the verified synthetic snapshot and prebuilt browser application."""
    import uvicorn

    from record_finder.api.app import create_app

    uvicorn.run(
        create_app(
            snapshot,
            web_root=web_root,
            model_cache=model_cache,
            model_manifest_path=model_manifest,
        ),
        host=host,
        port=port,
        access_log=False,
        proxy_headers=False,
    )


if __name__ == "__main__":
    app()
