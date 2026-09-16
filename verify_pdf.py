from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import importlib.util
import json
import re
import sys
from pathlib import Path
from typing import Any


PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT.parents[2]
DEFAULT_PDF = PROJECT / "output" / "人间铸剑录_v15_完整图解版.pdf"
DEFAULT_EVIDENCE = PROJECT / "evidence" / "full-pdf-check-v15.json"
TEXT_REVIEW = PROJECT / "output" / "人间铸剑录_v15_幼稚化ELI5_完整文字审稿版.md"
STORY_FILES = (
    PROJECT / "manuscript" / "story-go.json",
    PROJECT / "manuscript" / "story-backend.json",
    PROJECT / "manuscript" / "story-harness.json",
)

EXPECTED_STORY_UNITS = 71
EXPECTED_CODE_BLOCKS = 64
A4_POINTS = (595.28, 841.89)
BASE14_FONTS = {
    "/Courier", "/Courier-Bold", "/Courier-BoldOblique", "/Courier-Oblique",
    "/Helvetica", "/Helvetica-Bold", "/Helvetica-BoldOblique", "/Helvetica-Oblique",
    "/Symbol", "/Times-Bold", "/Times-BoldItalic", "/Times-Italic", "/Times-Roman",
    "/ZapfDingbats",
}
PLACEHOLDER_RE = re.compile(r"\b(?:TODO|TBD|undefined|NaN)\b", re.IGNORECASE)

V15_ANCHOR_GROUPS = {
    "chapter_1_settle_example": (
        "路边茶棚", "一碗面七文", "ErrInvalidPrice", "ErrInsufficientPayment",
    ),
    "chapter_14_sse_boundary": (
        "SSE 断线只停订阅", "业务取消要显式发出", "bill_id",
    ),
    "run_step_recovery_identity": (
        "Run", "Step", "CallID", "receipt", "Unknown",
    ),
    "chapter_24_entry_scope": (
        "tenant_id", "authenticated owner_id", "entry_key", "CreateQueuedOnce",
    ),
    "chapter_24_worker_closure": (
        "Handler 只创建持久 queued Run", "lease Worker", "receipt-req-0827",
    ),
}
FORBIDDEN_V15_ANCHORS = ("splitAmount", "水断在上游")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify the final v15 illustrated-book PDF.")
    parser.add_argument("pdf", nargs="?", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--output", type=Path, default=DEFAULT_EVIDENCE)
    parser.add_argument(
        "--structural-only",
        action="store_true",
        help="Skip v15 anchors and manuscript coverage; useful for parser self-tests.",
    )
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def normalize(text: str) -> str:
    return re.sub(r"\s+", "", text)


def package_version(distribution: str) -> str | None:
    try:
        return importlib.metadata.version(distribution)
    except importlib.metadata.PackageNotFoundError:
        return None


def dependency_preflight() -> dict[str, Any]:
    pypdf_available = importlib.util.find_spec("pypdf") is not None
    pdfplumber_available = importlib.util.find_spec("pdfplumber") is not None
    return {
        "python": sys.executable,
        "python_version": sys.version.split()[0],
        "pypdf": {
            "available": pypdf_available,
            "version": package_version("pypdf") if pypdf_available else None,
            "required": True,
        },
        "pdfplumber": {
            "available": pdfplumber_available,
            "version": package_version("pdfplumber") if pdfplumber_available else None,
            "required": False,
        },
        "text_extraction_backend": "pypdf" if pypdf_available else None,
    }


def dereference(value: Any) -> Any:
    return value.get_object() if hasattr(value, "get_object") else value


def flatten_outline(reader: Any) -> tuple[list[dict[str, Any]], list[str]]:
    entries: list[dict[str, Any]] = []
    failures: list[str] = []

    def visit(items: list[Any], depth: int = 0) -> None:
        for item in items:
            if isinstance(item, list):
                visit(item, depth + 1)
                continue
            title = str(getattr(item, "title", item))
            try:
                page_index = reader.get_destination_page_number(item)
                if not isinstance(page_index, int) or not 0 <= page_index < len(reader.pages):
                    raise ValueError(f"page index out of range: {page_index}")
                entries.append({"title": title, "page": page_index + 1, "depth": depth})
            except Exception as exc:
                failures.append(f"{title}: {type(exc).__name__}: {exc}")

    try:
        visit(reader.outline)
    except Exception as exc:
        failures.append(f"outline: {type(exc).__name__}: {exc}")
    return entries, failures


def resolve_link_destination(reader: Any, destination: Any) -> int | None:
    destination = dereference(destination)
    try:
        if isinstance(destination, str):
            named = reader.named_destinations.get(destination)
            return reader.get_destination_page_number(named) if named is not None else None
        if isinstance(destination, (list, tuple)) and destination:
            page = dereference(destination[0])
            return reader.get_page_number(page)
        return reader.get_destination_page_number(destination)
    except Exception:
        return None


def inspect_links(reader: Any) -> dict[str, Any]:
    internal: list[dict[str, int]] = []
    invalid: list[dict[str, Any]] = []
    external = 0
    for source_page, page in enumerate(reader.pages, 1):
        for annotation_ref in page.get("/Annots", []):
            annotation = dereference(annotation_ref)
            if annotation.get("/Subtype") != "/Link":
                continue
            destination = annotation.get("/Dest")
            action = dereference(annotation.get("/A")) if annotation.get("/A") else None
            if destination is None and action:
                action_type = action.get("/S")
                if action_type == "/GoTo":
                    destination = action.get("/D")
                elif action_type == "/URI":
                    external += 1
                    continue
            if destination is None:
                invalid.append({"source_page": source_page, "reason": "missing destination"})
                continue
            target_index = resolve_link_destination(reader, destination)
            if target_index is None or not 0 <= target_index < len(reader.pages):
                invalid.append({"source_page": source_page, "reason": "unresolvable destination"})
                continue
            internal.append({"source_page": source_page, "target_page": target_index + 1})
    return {
        "internal_count": len(internal),
        "external_count": external,
        "distinct_internal_targets": len({item["target_page"] for item in internal}),
        "invalid": invalid,
        "internal": internal,
    }


def inspect_fonts(reader: Any) -> dict[str, Any]:
    seen_objects: set[tuple[int, int] | int] = set()
    seen_names: set[str] = set()
    embedded: set[str] = set()
    base14: set[str] = set()
    missing: set[str] = set()

    def inspect_font(font_ref: Any) -> None:
        identity: tuple[int, int] | int
        if hasattr(font_ref, "idnum"):
            identity = (font_ref.idnum, getattr(font_ref, "generation", 0))
        else:
            identity = id(font_ref)
        if identity in seen_objects:
            return
        seen_objects.add(identity)
        font = dereference(font_ref)
        base_name = str(font.get("/BaseFont", "unknown"))
        seen_names.add(base_name)
        descendants = dereference(font.get("/DescendantFonts", []))
        if descendants:
            for descendant in descendants:
                inspect_font(descendant)
            return
        descriptor = font.get("/FontDescriptor")
        if descriptor:
            descriptor = dereference(descriptor)
            if any(descriptor.get(key) is not None for key in ("/FontFile", "/FontFile2", "/FontFile3")):
                embedded.add(base_name)
                return
        normalized_name = "/" + base_name.lstrip("/").split("+", 1)[-1]
        if normalized_name in BASE14_FONTS:
            base14.add(base_name)
        else:
            missing.add(base_name)

    for page in reader.pages:
        resources = page.get("/Resources")
        if not resources:
            continue
        fonts = dereference(dereference(resources).get("/Font", {}))
        for font_ref in fonts.values():
            inspect_font(font_ref)
    return {
        "seen_count": len(seen_names),
        "seen": sorted(seen_names),
        "embedded": sorted(embedded),
        "portable_base14": sorted(base14),
        "missing_or_nonportable": sorted(missing),
    }


def inspect_pages(reader: Any) -> tuple[dict[str, Any], list[str]]:
    page_records: list[dict[str, Any]] = []
    texts: list[str] = []
    extraction_errors: list[dict[str, Any]] = []
    for page_number, page in enumerate(reader.pages, 1):
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        rotation = int(page.get("/Rotate", 0) or 0) % 360
        effective_width, effective_height = (height, width) if rotation in (90, 270) else (width, height)
        try:
            text = page.extract_text() or ""
        except Exception as exc:
            text = ""
            extraction_errors.append({
                "page": page_number,
                "error": f"{type(exc).__name__}: {exc}",
            })
        texts.append(text)
        page_records.append({
            "page": page_number,
            "width": round(width, 3),
            "height": round(height, 3),
            "rotation": rotation,
            "orientation": "landscape" if effective_width > effective_height else "portrait",
            "text_chars": len(text),
        })

    unique_sizes = sorted({(item["width"], item["height"]) for item in page_records})
    non_a4_pages = []
    for item in page_records:
        actual = sorted((item["width"], item["height"]))
        expected = sorted(A4_POINTS)
        if any(abs(left - right) > 2.0 for left, right in zip(actual, expected)):
            non_a4_pages.append(item["page"])
    page_summary = {
        "count": len(page_records),
        "unique_sizes": [{"width": width, "height": height} for width, height in unique_sizes],
        "portrait_pages": [item["page"] for item in page_records if item["orientation"] == "portrait"],
        "landscape_pages": [item["page"] for item in page_records if item["orientation"] == "landscape"],
        "rotated_pages": [item["page"] for item in page_records if item["rotation"] != 0],
        "non_a4_pages": non_a4_pages,
        "records": page_records,
        "extraction_errors": extraction_errors,
    }
    return page_summary, texts


def page_hits(texts: list[str], needle: str) -> list[int]:
    normalized_needle = normalize(needle)
    return [index for index, text in enumerate(texts, 1) if normalized_needle in normalize(text)]


def inspect_text_anomalies(texts: list[str]) -> dict[str, Any]:
    placeholder_hits: list[dict[str, Any]] = []
    for page_number, text in enumerate(texts, 1):
        for match in PLACEHOLDER_RE.finditer(text):
            start = max(0, match.start() - 35)
            end = min(len(text), match.end() + 35)
            placeholder_hits.append({
                "page": page_number,
                "token": match.group(0),
                "context": re.sub(r"\s+", " ", text[start:end]).strip(),
            })
    return {
        "empty_pages": [index for index, text in enumerate(texts, 1) if not normalize(text)],
        "nul_pages": [index for index, text in enumerate(texts, 1) if "\x00" in text],
        "replacement_character_pages": [index for index, text in enumerate(texts, 1) if "\ufffd" in text],
        "unexpected_ellipsis_pages": [index for index, text in enumerate(texts, 1) if "\u2026" in text],
        "placeholder_hits": placeholder_hits,
        "ellipsis_policy": "U+2026 is rejected; three ASCII dots remain valid Go variadic syntax.",
    }


def select_code_anchors(code: str) -> list[str]:
    candidates = []
    for line in code.splitlines():
        normalized_line = normalize(line)
        if len(normalized_line) >= 8 and normalized_line not in {"returnnil", "returnerr"}:
            candidates.append(normalized_line)
    ranked = sorted(dict.fromkeys(candidates), key=lambda item: (-len(item), item))
    return ranked[:3]


def load_v15_contract() -> dict[str, Any]:
    manuscript = TEXT_REVIEW.read_text(encoding="utf-8")
    code_blocks = re.findall(r"```go\s*\n(.*?)\n```", manuscript, re.DOTALL)
    explanations = re.findall(
        r"^#{2,3} (?:3\. )?小白一句话\s*$\n+([^\n]+)", manuscript, re.MULTILINE,
    )
    story_units: list[dict[str, Any]] = []
    for story_file in STORY_FILES:
        payload = json.loads(story_file.read_text(encoding="utf-8"))
        for kind in ("chapters", "supplements"):
            for unit_id, item in payload.get(kind, {}).items():
                story_units.append({
                    "id": f"{kind[:-1]}:{unit_id}",
                    "fragments": [*item["opening"], item["closing"]],
                })
    return {
        "manuscript_sha256": sha256(TEXT_REVIEW),
        "story_file_sha256": {path.name: sha256(path) for path in STORY_FILES},
        "story_units": story_units,
        "explanations": explanations,
        "code_blocks": code_blocks,
    }


def inspect_v15_content(texts: list[str]) -> tuple[dict[str, Any], list[str]]:
    failures: list[str] = []
    all_text = "\n".join(texts)
    normalized_pdf = normalize(all_text)
    contract = load_v15_contract()

    anchor_groups: dict[str, Any] = {}
    for group_name, needles in V15_ANCHOR_GROUPS.items():
        hits = {needle: page_hits(texts, needle) for needle in needles}
        missing = [needle for needle, pages in hits.items() if not pages]
        anchor_groups[group_name] = {"hits": hits, "missing": missing}
        if missing:
            failures.append(f"{group_name} missing anchors: {missing}")

    forbidden_hits = {needle: page_hits(texts, needle) for needle in FORBIDDEN_V15_ANCHORS}
    if any(forbidden_hits.values()):
        failures.append(f"forbidden v15 anchors returned: {forbidden_hits}")

    missing_story_units = []
    for unit in contract["story_units"]:
        if not all(normalize(fragment) in normalized_pdf for fragment in unit["fragments"]):
            missing_story_units.append(unit["id"])

    missing_explanations = []
    for index, explanation in enumerate(contract["explanations"], 1):
        if normalize(explanation) not in normalized_pdf:
            missing_explanations.append({"index": index, "text": explanation})

    missing_code_blocks = []
    for index, code in enumerate(contract["code_blocks"], 1):
        anchors = select_code_anchors(code)
        missing = [anchor for anchor in anchors if anchor not in normalized_pdf]
        if not anchors or missing:
            missing_code_blocks.append({
                "index": index,
                "anchors": anchors,
                "missing": missing or ["no stable anchor line"],
            })

    story_count = len(contract["story_units"])
    explanation_count = len(contract["explanations"])
    code_count = len(contract["code_blocks"])
    if story_count != EXPECTED_STORY_UNITS:
        failures.append(f"story contract expected {EXPECTED_STORY_UNITS}, got {story_count}")
    if explanation_count != EXPECTED_STORY_UNITS:
        failures.append(f"explanation contract expected {EXPECTED_STORY_UNITS}, got {explanation_count}")
    if code_count != EXPECTED_CODE_BLOCKS:
        failures.append(f"code contract expected {EXPECTED_CODE_BLOCKS}, got {code_count}")
    if missing_story_units:
        failures.append(f"missing story units in PDF: {len(missing_story_units)}")
    if missing_explanations:
        failures.append(f"missing beginner explanations in PDF: {len(missing_explanations)}")
    if missing_code_blocks:
        failures.append(f"missing or truncated code blocks in PDF: {len(missing_code_blocks)}")

    return {
        "contract": {
            "manuscript": str(TEXT_REVIEW.relative_to(ROOT)),
            "manuscript_sha256": contract["manuscript_sha256"],
            "story_file_sha256": contract["story_file_sha256"],
        },
        "anchor_groups": anchor_groups,
        "forbidden_anchor_hits": forbidden_hits,
        "story_coverage": {
            "expected": EXPECTED_STORY_UNITS,
            "contract_units": story_count,
            "covered": story_count - len(missing_story_units),
            "missing": missing_story_units,
        },
        "explanation_coverage": {
            "expected": EXPECTED_STORY_UNITS,
            "contract_units": explanation_count,
            "covered": explanation_count - len(missing_explanations),
            "missing": missing_explanations,
        },
        "code_block_coverage": {
            "expected": EXPECTED_CODE_BLOCKS,
            "contract_blocks": code_count,
            "covered": code_count - len(missing_code_blocks),
            "missing": missing_code_blocks,
            "method": "three longest whitespace-normalized nontrivial source lines per code block",
        },
    }, failures


def inspect_pdf(pdf_path: Path, structural_only: bool) -> dict[str, Any]:
    dependencies = dependency_preflight()
    failures: list[str] = []
    payload: dict[str, Any] = {
        "status": "fail",
        "profile": "structural-only" if structural_only else "v15-final",
        "pdf": str(pdf_path),
        "dependencies": dependencies,
        "failures": failures,
    }
    if not dependencies["pypdf"]["available"]:
        failures.append("required dependency pypdf is unavailable")
        return payload
    if not pdf_path.is_file() or pdf_path.stat().st_size == 0:
        failures.append(f"missing or empty PDF: {pdf_path}")
        return payload

    from pypdf import PdfReader

    payload["pdf_bytes"] = pdf_path.stat().st_size
    payload["pdf_sha256"] = sha256(pdf_path)
    try:
        reader = PdfReader(str(pdf_path))
    except Exception as exc:
        failures.append(f"cannot open PDF: {type(exc).__name__}: {exc}")
        return payload

    payload["encrypted"] = bool(reader.is_encrypted)
    if reader.is_encrypted:
        failures.append("PDF is unexpectedly encrypted")
        return payload

    metadata = {str(key): str(value) for key, value in (reader.metadata or {}).items()}
    payload["metadata"] = metadata
    metadata_text = " ".join(metadata.values())
    if not metadata.get("/Title", "").strip():
        failures.append("metadata title is empty")
    if "人间铸剑录" not in metadata_text:
        failures.append("metadata does not identify 人间铸剑录")
    if not structural_only and "v15" not in metadata_text.casefold():
        failures.append("metadata does not identify v15")

    pages, texts = inspect_pages(reader)
    payload["pages"] = pages
    if pages["count"] == 0:
        failures.append("PDF has no pages")
    if pages["non_a4_pages"]:
        failures.append(f"non-A4 pages: {pages['non_a4_pages']}")
    if pages["extraction_errors"]:
        failures.append(f"text extraction errors: {len(pages['extraction_errors'])}")

    bookmarks, bookmark_failures = flatten_outline(reader)
    payload["bookmarks"] = {
        "count": len(bookmarks),
        "top_level_count": sum(item["depth"] == 0 for item in bookmarks),
        "invalid": bookmark_failures,
        "entries": bookmarks,
    }
    if not bookmarks:
        failures.append("PDF has no bookmarks")
    if bookmark_failures:
        failures.append(f"invalid bookmarks: {len(bookmark_failures)}")

    links = inspect_links(reader)
    payload["links"] = links
    if links["internal_count"] < 24:
        failures.append(f"expected at least 24 internal links, got {links['internal_count']}")
    if links["invalid"]:
        failures.append(f"invalid link annotations: {len(links['invalid'])}")

    fonts = inspect_fonts(reader)
    payload["fonts"] = fonts
    if fonts["missing_or_nonportable"]:
        failures.append(f"fonts are neither embedded nor Base14: {fonts['missing_or_nonportable']}")

    anomalies = inspect_text_anomalies(texts)
    payload["text_anomalies"] = anomalies
    for field in (
        "empty_pages", "nul_pages", "replacement_character_pages", "unexpected_ellipsis_pages",
    ):
        if anomalies[field]:
            failures.append(f"{field}: {anomalies[field]}")
    if anomalies["placeholder_hits"]:
        failures.append(f"placeholder tokens found: {len(anomalies['placeholder_hits'])}")

    if not structural_only:
        try:
            v15_content, content_failures = inspect_v15_content(texts)
            payload["v15_content"] = v15_content
            failures.extend(content_failures)
        except Exception as exc:
            failures.append(f"cannot verify v15 content contract: {type(exc).__name__}: {exc}")

    payload["status"] = "pass" if not failures else "fail"
    return payload


def main() -> int:
    args = parse_args()
    pdf_path = args.pdf.expanduser().resolve()
    output_path = args.output.expanduser()
    if not output_path.is_absolute():
        output_path = (Path.cwd() / output_path).resolve()
    payload = inspect_pdf(pdf_path, args.structural_only)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    compact = {
        "status": payload["status"],
        "profile": payload["profile"],
        "pdf_sha256": payload.get("pdf_sha256"),
        "pages": payload.get("pages", {}).get("count"),
        "bookmarks": payload.get("bookmarks", {}).get("count"),
        "internal_links": payload.get("links", {}).get("internal_count"),
        "failures": payload["failures"],
        "evidence": str(output_path),
    }
    print(json.dumps(compact, ensure_ascii=False))
    return 0 if payload["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
