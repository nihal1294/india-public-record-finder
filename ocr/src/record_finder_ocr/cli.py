"""Stdin/stdout command for the one-request OCR worker protocol."""

import json
import sys
from pathlib import Path
from typing import Literal

import typer
from pydantic import BaseModel, ConfigDict

from record_finder_ocr.paddle import recognize


class OCRRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1]
    image_path: Path
    script: Literal["kannada", "latin", "numeric"]


app = typer.Typer(add_completion=False, invoke_without_command=True)


@app.callback()
def run() -> None:
    request = OCRRequest.model_validate_json(sys.stdin.read())
    if not request.image_path.is_file():
        raise typer.BadParameter("image_path does not exist")
    print(
        json.dumps(
            recognize(request.image_path, request.script), ensure_ascii=False, separators=(",", ":")
        )
    )
