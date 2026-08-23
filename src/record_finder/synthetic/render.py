"""Render the fixed, fictional ten-record feasibility page."""

import hashlib
import json
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.utils import ImageReader  # type: ignore[import-untyped]
from reportlab.pdfgen import canvas  # type: ignore[import-untyped]

from record_finder.domain.models import GeneratedRecord, SourceReference, SyntheticTruthRecord
from record_finder.synthetic.catalog import CATALOG, SEED, SPIKE_CATALOG, KarnatakaSyntheticAdapter

PAGE_WIDTH = 900
CARD_HEIGHT = 430
PAGE_HEIGHT = CARD_HEIGHT * len(SPIKE_CATALOG)
REQUIRED_FIELDS = frozenset({"name", "relative_name", "locality", "age", "synthetic_id"})
FONT_PATH = (
    Path(__file__).parents[3]
    / "apps/web/public/fonts/noto-sans-kannada/NotoSansKannada-Regular.ttf"
)


def sha256_path(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@dataclass(frozen=True)
class GeneratedManifest:
    content_digest: str
    record_count: int
    pdf_count: int
    pdf_path: Path
    truth_path: Path
    crop_registry_path: Path
    pdf_paths: tuple[Path, ...] = ()
    page_count: int = 1


@dataclass
class GeneratedCorpus:
    manifest: GeneratedManifest
    records: list[GeneratedRecord]
    field_bboxes: dict[str, dict[str, tuple[int, int, int, int]]]


def _font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size=size)


def _draw_value(
    page: Image.Image, bbox: tuple[int, int, int, int], text: str, *, faded: bool, skewed: bool
) -> None:
    width, height = bbox[2] - bbox[0], bbox[3] - bbox[1]
    layer = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    draw = ImageDraw.Draw(layer)
    text_font = _font(30 if any("\u0c80" <= char <= "\u0cff" for char in text) else 26)
    draw.text((4, 3), text, font=text_font, fill=(15, 15, 15, 155 if faded else 255))
    if skewed:
        layer = layer.rotate(
            1, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=(255, 255, 255, 0)
        )
    page.alpha_composite(layer, (bbox[0], bbox[1]))


def _digest_payload(records: list[GeneratedRecord]) -> str:
    payload = [
        {
            "id": record.truth.synthetic_id,
            "truth": record.truth.model_dump(mode="json"),
            "crops": {key: sha256_path(value) for key, value in sorted(record.field_crops.items())},
            "evidence": sha256_path(record.evidence_crop),
        }
        for record in records
    ]
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


def render_spike(output: Path) -> GeneratedCorpus:
    """Render one deterministic raster PDF and crop each value field."""
    if not FONT_PATH.is_file():
        raise FileNotFoundError(f"required Kannada font is missing: {FONT_PATH}")
    output.mkdir(parents=True, exist_ok=True)
    field_root = output / "field-crops"
    evidence_root = output / "evidence"
    field_root.mkdir(exist_ok=True)
    evidence_root.mkdir(exist_ok=True)

    page = Image.new("RGBA", (PAGE_WIDTH, PAGE_HEIGHT), "white")
    draw = ImageDraw.Draw(page)
    adapter = KarnatakaSyntheticAdapter()
    records: list[GeneratedRecord] = []
    field_bboxes: dict[str, dict[str, tuple[int, int, int, int]]] = {}
    truth_rows: list[dict[str, object]] = []
    for index, entry in enumerate(SPIKE_CATALOG):
        y_offset = index * CARD_HEIGHT
        draw.rectangle(
            (8, y_offset + 8, PAGE_WIDTH - 8, y_offset + CARD_HEIGHT - 8),
            outline="#202020",
            width=2,
        )
        draw.text((30, y_offset + 6), "Synthetic Karnataka record", font=_font(15), fill="#555555")
        values = {
            "synthetic_id": entry.synthetic_id,
            "name": entry.name_native,
            "name_latin": entry.name_latin,
            "relative_name": entry.relative_name_native,
            "relative_name_latin": entry.relative_name_latin,
            "locality": entry.locality_native,
            "locality_latin": entry.locality_latin,
            "house_reference": entry.house_reference,
            "age": str(entry.age),
            "gender": entry.gender,
        }
        absolute_boxes: dict[str, tuple[int, int, int, int]] = {}
        for field, local in adapter.field_geometry.items():
            bbox = (local[0], local[1] + y_offset, local[2], local[3] + y_offset)
            absolute_boxes[field] = bbox
            _draw_value(
                page,
                bbox,
                values[field],
                faded=index == 3 and field == "locality",
                skewed=index == 6 and field == "relative_name",
            )
        evidence_path = evidence_root / f"{entry.synthetic_id}.png"
        page.crop((0, y_offset, PAGE_WIDTH, y_offset + CARD_HEIGHT)).convert("RGB").save(
            evidence_path
        )
        evidence_sha256 = sha256_path(evidence_path)
        source = SourceReference(
            snapshot_id="synthetic-karnataka-spike-v1",
            pdf_id="synthetic-karnataka-spike.pdf",
            part_number=1,
            page_number=1,
            record_bbox=(0, y_offset, PAGE_WIDTH, y_offset + CARD_HEIGHT),
            evidence_id=f"evidence-{entry.synthetic_id}",
            evidence_sha256=evidence_sha256,
        )
        truth = SyntheticTruthRecord(
            synthetic_id=entry.synthetic_id,
            name_native=entry.name_native,
            name_latin=entry.name_latin,
            relative_name_native=entry.relative_name_native,
            relative_name_latin=entry.relative_name_latin,
            relationship=entry.relationship,
            locality_native=entry.locality_native,
            locality_latin=entry.locality_latin,
            house_reference=entry.house_reference,
            age=entry.age,
            gender=entry.gender,
            source=source,
        )
        crops: dict[str, Path] = {}
        per_record_root = field_root / entry.synthetic_id
        per_record_root.mkdir(exist_ok=True)
        for field, bbox in absolute_boxes.items():
            crop_path = per_record_root / f"{field}.png"
            page.crop(bbox).convert("RGB").save(crop_path)
            crops[field] = crop_path
        records.append(GeneratedRecord(truth=truth, field_crops=crops, evidence_crop=evidence_path))
        field_bboxes[entry.synthetic_id] = absolute_boxes
        truth_rows.append(truth.model_dump(mode="json"))
    pdf_path = output / "synthetic-karnataka-spike.pdf"
    page.convert("RGB").save(pdf_path, "PDF", resolution=300.0)
    truth_path = output / "truth.json"
    truth_path.write_text(
        json.dumps({"seed": SEED, "records": truth_rows}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    crop_registry_path = output / "crop-registry.json"
    registry = {
        "schema_version": 1,
        "template_id": adapter.template_id,
        "crops": {
            path.relative_to(output).as_posix(): {
                "synthetic_id": record.truth.synthetic_id,
                "field": field,
                "crop_bbox": field_bboxes[record.truth.synthetic_id][field],
                "crop_sha256": sha256_path(path),
            }
            for record in records
            for field, path in record.field_crops.items()
        },
    }
    crop_registry_path.write_text(
        json.dumps(registry, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return GeneratedCorpus(
        manifest=GeneratedManifest(
            content_digest=_digest_payload(records),
            record_count=len(records),
            pdf_count=1,
            pdf_path=pdf_path,
            truth_path=truth_path,
            crop_registry_path=crop_registry_path,
        ),
        records=records,
        field_bboxes=field_bboxes,
    )


def _source_reference(
    *,
    pdf_number: int,
    page_number: int,
    record_bbox: tuple[int, int, int, int],
    evidence_id: str,
    evidence_sha256: str,
) -> SourceReference:
    return SourceReference(
        snapshot_id="synthetic-karnataka-demo-v1",
        pdf_id=f"synthetic-karnataka-demo-{pdf_number}.pdf",
        part_number=pdf_number,
        page_number=page_number,
        record_bbox=record_bbox,
        evidence_id=evidence_id,
        evidence_sha256=evidence_sha256,
    )


def _write_demo_pdf(path: Path, pages: list[Image.Image]) -> None:
    """Write a fixed-metadata PDF so identical synthetic pages hash identically."""
    writer = canvas.Canvas(
        str(path), pagesize=(PAGE_WIDTH, CARD_HEIGHT * 10), invariant=1, pageCompression=1
    )
    writer.setAuthor("India Public Record Finder")
    writer.setCreator("India Public Record Finder")
    writer.setSubject("Synthetic Karnataka record")
    writer.setTitle("Synthetic Karnataka record")
    for page in pages:
        writer.drawImage(
            ImageReader(page), 0, 0, width=PAGE_WIDTH, height=CARD_HEIGHT * 10, mask="auto"
        )
        writer.showPage()
    writer.save()


def render_demo_source(output: Path) -> GeneratedCorpus:
    """Render the immutable 120-record, 12-page fictional demo source."""
    if not FONT_PATH.is_file():
        raise FileNotFoundError(f"required Kannada font is missing: {FONT_PATH}")
    if len(CATALOG) != 120:
        raise ValueError("the demo catalogue must contain exactly 120 records")
    output.mkdir(parents=True, exist_ok=True)
    evidence_root = output / "evidence"
    field_root = output / "field-crops"
    pdf_root = output / "pdfs"
    for directory in (evidence_root, field_root, pdf_root):
        directory.mkdir(exist_ok=True)

    adapter = KarnatakaSyntheticAdapter()
    records: list[GeneratedRecord] = []
    field_bboxes: dict[str, dict[str, tuple[int, int, int, int]]] = {}
    truth_rows: list[dict[str, object]] = []
    page_images: list[Image.Image] = []
    for page_index in range(12):
        page = Image.new("RGBA", (PAGE_WIDTH, CARD_HEIGHT * 10), "white")
        draw = ImageDraw.Draw(page)
        for card_index, entry in enumerate(CATALOG[page_index * 10 : (page_index + 1) * 10]):
            y_offset = card_index * CARD_HEIGHT
            draw.rectangle(
                (8, y_offset + 8, PAGE_WIDTH - 8, y_offset + CARD_HEIGHT - 8),
                outline="#202020",
                width=2,
            )
            draw.text(
                (30, y_offset + 6), "Synthetic Karnataka record", font=_font(15), fill="#555555"
            )
            values = {
                "synthetic_id": entry.synthetic_id,
                "name": entry.name_native,
                "name_latin": entry.name_latin,
                "relative_name": entry.relative_name_native,
                "relative_name_latin": entry.relative_name_latin,
                "locality": entry.locality_native,
                "locality_latin": entry.locality_latin,
                "house_reference": entry.house_reference,
                "age": str(entry.age),
                "gender": entry.gender,
            }
            absolute_boxes: dict[str, tuple[int, int, int, int]] = {}
            for field, local in adapter.field_geometry.items():
                bbox = (local[0], local[1] + y_offset, local[2], local[3] + y_offset)
                absolute_boxes[field] = bbox
                _draw_value(
                    page,
                    bbox,
                    values[field],
                    faded=entry.synthetic_id == "SYN-KA-D" and field == "locality",
                    skewed=entry.synthetic_id == "SYN-KA-G" and field == "relative_name",
                )
            evidence_id = f"evidence-{entry.synthetic_id}"
            evidence_path = evidence_root / f"{evidence_id}.png"
            page.crop((0, y_offset, PAGE_WIDTH, y_offset + CARD_HEIGHT)).convert("RGB").save(
                evidence_path
            )
            source = _source_reference(
                pdf_number=page_index // 4 + 1,
                page_number=page_index % 4 + 1,
                record_bbox=(0, y_offset, PAGE_WIDTH, y_offset + CARD_HEIGHT),
                evidence_id=evidence_id,
                evidence_sha256=sha256_path(evidence_path),
            )
            truth = SyntheticTruthRecord(
                synthetic_id=entry.synthetic_id,
                name_native=entry.name_native,
                name_latin=entry.name_latin,
                relative_name_native=entry.relative_name_native,
                relative_name_latin=entry.relative_name_latin,
                relationship=entry.relationship,
                locality_native=entry.locality_native,
                locality_latin=entry.locality_latin,
                house_reference=entry.house_reference,
                age=entry.age,
                gender=entry.gender,
                source=source,
            )
            field_paths: dict[str, Path] = {}
            record_field_root = field_root / entry.synthetic_id
            record_field_root.mkdir(exist_ok=True)
            for field, bbox in absolute_boxes.items():
                crop_path = record_field_root / f"{field}.png"
                page.crop(bbox).convert("RGB").save(crop_path)
                field_paths[field] = crop_path
            records.append(
                GeneratedRecord(truth=truth, field_crops=field_paths, evidence_crop=evidence_path)
            )
            field_bboxes[entry.synthetic_id] = absolute_boxes
            truth_rows.append(truth.model_dump(mode="json"))
        page_images.append(page.convert("RGB"))

    pdf_paths: list[Path] = []
    for pdf_index in range(3):
        pdf_path = pdf_root / f"synthetic-karnataka-demo-{pdf_index + 1}.pdf"
        pages = page_images[pdf_index * 4 : (pdf_index + 1) * 4]
        _write_demo_pdf(pdf_path, pages)
        pdf_paths.append(pdf_path)
    truth_path = output / "truth.json"
    truth_path.write_text(
        json.dumps({"seed": SEED, "records": truth_rows}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    crop_registry_path = output / "crop-registry.json"
    crop_registry_path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "template_id": adapter.template_id,
                "crops": {
                    path.relative_to(output).as_posix(): {
                        "synthetic_id": record.truth.synthetic_id,
                        "field": field,
                        "crop_bbox": field_bboxes[record.truth.synthetic_id][field],
                        "crop_sha256": sha256_path(path),
                    }
                    for record in records
                    for field, path in record.field_crops.items()
                },
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    return GeneratedCorpus(
        manifest=GeneratedManifest(
            content_digest=_digest_payload(records),
            record_count=120,
            pdf_count=3,
            pdf_path=pdf_paths[0],
            truth_path=truth_path,
            crop_registry_path=crop_registry_path,
            pdf_paths=tuple(pdf_paths),
            page_count=12,
        ),
        records=records,
        field_bboxes=field_bboxes,
    )


def normalize_text(value: str) -> str:
    normalized = " ".join(unicodedata.normalize("NFC", value).split()).strip()
    if any("\u0c80" <= char <= "\u0cff" for char in normalized):
        return normalized.replace(" ", "")
    return normalized
