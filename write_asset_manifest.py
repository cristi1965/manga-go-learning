from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
PROJECT = ROOT / "work" / "book" / "v15-text-review"
ASSET_ROOT = ROOT / "output" / "book-v8-assets"
DIAGRAM_ROOT = ROOT / "work" / "book" / "v10-project" / "diagrams" / "rendered"
AVATAR_ROOT = PROJECT / "assets" / "chat-avatars"
OUTPUT = PROJECT / "evidence" / "asset-manifest-v15.json"
V11_AVATAR_MANIFEST = (
    ROOT / "work" / "book" / "v11-project" / "evidence" / "chat-avatar-cache.json"
)

DEFAULT_CROP = "square-512-face-0.50-0.23-zoom-1.33-circle-v2"
ZHOUMILI_CROP = "square-512-face-0.50-0.34-zoom-1.33-circle-v1"

PORTRAITS = {
    "阿良": (ASSET_ROOT / "aliang-animation-pilot-v8-r2.jpg", DEFAULT_CROP),
    "齐静春": (ASSET_ROOT / "qijingchun-animation-pilot-v8.jpg", DEFAULT_CROP),
    "陈平安": (ASSET_ROOT / "chenpingan-animation-v8.jpg", DEFAULT_CROP),
    "宁姚": (ASSET_ROOT / "ningyao-animation-pilot-v8.jpg", DEFAULT_CROP),
    "崔瀺": (ASSET_ROOT / "cuican-animation-v8.jpg", DEFAULT_CROP),
    "左右": (ASSET_ROOT / "zuoyou-inferred-animation-v8.jpg", DEFAULT_CROP),
    "李宝瓶": (ASSET_ROOT / "libaoping-animation-v8.jpg", DEFAULT_CROP),
    "阮秀": (ASSET_ROOT / "ruanxiu-animation-v8.jpg", DEFAULT_CROP),
    "剑灵": (ASSET_ROOT / "swordspirit-animation-pilot-v8.jpg", DEFAULT_CROP),
    "陆沉": (ASSET_ROOT / "luchen-animation-v8.jpg", DEFAULT_CROP),
    "顾璨": (ASSET_ROOT / "gucan-animation-v8.jpg", DEFAULT_CROP),
    "崔东山": (ASSET_ROOT / "cuidongshan-animation-v8.jpg", DEFAULT_CROP),
    "周米粒": (ROOT / "output" / "imagegen" / "v5" / "zhoumili-v5.png", ZHOUMILI_CROP),
}

DIAGRAM_USAGE = {
    "agent-tool-skill-mcp-harness": ["chapter-18"],
    "approval-capability-sequence": ["chapter-21"],
    "book-learning-map": ["learning-map", "chapter-01", "chapter-24"],
    "bounded-concurrency-flow": ["chapter-13"],
    "cache-aside-sequence": ["chapter-12"],
    "coding-harness-loop": ["chapter-23"],
    "context-cancellation-sequence": ["chapter-08", "chapter-14"],
    "context-security-gates": ["chapter-20"],
    "deployment-migration-flow": ["chapter-16"],
    "error-contract-flow": ["chapter-06"],
    "evidence-replay-matrix": ["chapter-22"],
    "go-function-anatomy": ["chapter-01"],
    "go-pointer-copy": ["chapter-03"],
    "go-project-architecture": ["chapter-05", "chapter-09"],
    "go-slice-copy": ["chapter-03"],
    "go-value-copy": ["chapter-03"],
    "goroutine-channel-runtime": ["chapter-07"],
    "goroutine-lifecycle-closure": ["chapter-08"],
    "handler-service-repository-flow": ["chapter-10"],
    "harness-seven-domains": ["chapter-18", "chapter-24"],
    "idempotency-sequence": ["chapter-11"],
    "interface-capability-contract": ["chapter-04"],
    "ledger-agent-evidence-path": ["chapter-24"],
    "ledger-agent-main-path": ["chapter-24"],
    "llm-workflow-agent-compare": ["chapter-17"],
    "observability-trace-architecture": ["chapter-15", "chapter-22"],
    "request-dependency-sequence": ["chapter-10"],
    "run-approval-state-machine": ["chapter-19"],
    "sandbox-capability-gates": ["chapter-21"],
    "struct-json-pipeline": ["chapter-02", "chapter-09"],
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(ROOT))


def inspect_image(path: Path) -> dict[str, object]:
    if not path.is_file():
        raise FileNotFoundError(f"missing asset: {relative(path)}")
    with Image.open(path) as image:
        image.load()
        width, height = image.size
        mode = image.mode
        image_format = image.format
    return {
        "path": relative(path),
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
        "width_px": width,
        "height_px": height,
        "mode": mode,
        "format": image_format,
    }


def expected_avatar_path(speaker: str, source_sha256: str, crop_contract: str) -> Path:
    fingerprint = hashlib.sha256(
        f"{source_sha256}:{crop_contract}".encode("utf-8")
    ).hexdigest()[:16]
    return AVATAR_ROOT / f"{speaker}-{fingerprint}.png"


def validate_accepted_portraits(source_entries: dict[str, dict[str, object]]) -> None:
    accepted = json.loads(V11_AVATAR_MANIFEST.read_text(encoding="utf-8"))
    for speaker in sorted(set(PORTRAITS) - {"周米粒"}):
        expected = accepted[speaker]
        actual = source_entries[speaker]
        if actual["path"] != expected["source"]:
            raise ValueError(f"accepted portrait path changed for {speaker}")
        if actual["sha256"] != expected["source_sha256"]:
            raise ValueError(f"accepted portrait hash changed for {speaker}")
        if expected["crop_contract"] != DEFAULT_CROP:
            raise ValueError(f"accepted crop contract changed for {speaker}")


def add_asset(
    assets: list[dict[str, object]],
    asset_id: str,
    kind: str,
    purpose: str,
    path: Path,
    *,
    source: str,
    used_by: list[str] | None = None,
    crop_contract: str | None = None,
    source_path: str | None = None,
    source_sha256: str | None = None,
) -> dict[str, object]:
    entry = {
        "id": asset_id,
        "kind": kind,
        "purpose": purpose,
        **inspect_image(path),
        "source": source,
    }
    if used_by is not None:
        entry["used_by"] = used_by
    if crop_contract is not None:
        entry["crop_contract"] = crop_contract
    if source_path is not None:
        entry["source_path"] = source_path
    if source_sha256 is not None:
        entry["source_sha256"] = source_sha256
    assets.append(entry)
    return entry


def build_manifest() -> dict[str, object]:
    assets: list[dict[str, object]] = []
    add_asset(
        assets, "cover", "cover", "full-page cover", ASSET_ROOT / "cover-print.jpg",
        source="accepted v8 local master",
    )
    add_asset(
        assets, "character-sheet", "character_sheet", "character overview",
        ASSET_ROOT / "character-sheet-print.jpg", source="derived from accepted v8 portrait masters",
    )

    for index in range(1, 4):
        add_asset(
            assets, f"volume-{index:02d}", "volume_illustration", f"volume {index} opener",
            ASSET_ROOT / f"volume-{index}.jpg", source="derived from accepted v8 chapter scenes",
            used_by=[f"volume-{index}"],
        )

    for index in range(1, 13):
        first_chapter = index * 2 - 1
        add_asset(
            assets, f"scene-{index:02d}", "chapter_scene", "two-chapter thematic scene",
            ASSET_ROOT / f"scene-{index}.jpg", source="accepted v8 local scene master",
            used_by=[f"chapter-{first_chapter:02d}", f"chapter-{first_chapter + 1:02d}"],
        )

    portrait_entries: dict[str, dict[str, object]] = {}
    for speaker, (path, crop_contract) in PORTRAITS.items():
        portrait_entries[speaker] = add_asset(
            assets, f"portrait-source-{speaker}", "portrait_source", f"avatar source for {speaker}",
            path, source=(
                "accepted v8 portrait master"
                if speaker != "周米粒" else "retained v5 portrait candidate"
            ),
            used_by=["chat-avatar-derivative"], crop_contract=crop_contract,
        )
    validate_accepted_portraits(portrait_entries)

    for slug, used_by in DIAGRAM_USAGE.items():
        add_asset(
            assets, f"diagram-{slug}", "technical_diagram", "technical explanation",
            DIAGRAM_ROOT / f"{slug}.png", source="v10 deterministic rendered diagram",
            used_by=used_by,
        )

    for speaker, source_entry in portrait_entries.items():
        crop_contract = PORTRAITS[speaker][1]
        avatar_path = expected_avatar_path(speaker, str(source_entry["sha256"]), crop_contract)
        avatar = add_asset(
            assets, f"chat-avatar-{speaker}", "chat_avatar_derivative", f"round chat avatar for {speaker}",
            avatar_path, source="deterministic crop from portrait source", used_by=["story-dialogue"],
            crop_contract=crop_contract, source_path=str(source_entry["path"]),
            source_sha256=str(source_entry["sha256"]),
        )
        if (avatar["width_px"], avatar["height_px"], avatar["mode"]) != (512, 512, "RGBA"):
            raise ValueError(f"invalid chat avatar derivative for {speaker}: {avatar['path']}")

    counts: dict[str, int] = {}
    for asset in assets:
        kind = str(asset["kind"])
        counts[kind] = counts.get(kind, 0) + 1
    return {
        "schema_version": 1,
        "artifact_version": "15.0.0",
        "policy": "reuse accepted local masters; zero image API calls",
        "crop_contracts": {
            "default": DEFAULT_CROP,
            "周米粒": ZHOUMILI_CROP,
        },
        "provenance": {
            "accepted_portrait_manifest": relative(V11_AVATAR_MANIFEST),
            "accepted_scene_register": "work/book/v5-project/images/TOOL_DECISION.md",
            "scene_usage_plan": "work/book/v5-project/images/scene-plan-v8.md",
            "diagram_generator": "work/book/v10-project/build/generate_v10_diagrams.py",
        },
        "counts": {**dict(sorted(counts.items())), "total": len(assets)},
        "diagram_placements": sum(len(items) for items in DIAGRAM_USAGE.values()),
        "assets": assets,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Write the v15 reused-asset manifest.")
    parser.parse_args()
    manifest = build_manifest()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(OUTPUT)
    print(f"assets={manifest['counts']['total']} diagram_placements={manifest['diagram_placements']}")


if __name__ == "__main__":
    main()
