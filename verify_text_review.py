from __future__ import annotations

import collections
import hashlib
import importlib.util
import json
import re
from pathlib import Path


PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT.parents[2]
BUILDER_PATH = PROJECT / "build_text_review.py"
DOC = PROJECT / "output" / "人间铸剑录_v15_幼稚化ELI5_完整文字审稿版.md"
EVIDENCE = PROJECT / "evidence" / "text-review-quality.json"
V14_PDF = ROOT / "work" / "book" / "v14-project" / "output" / "final.pdf"
EXPECTED_V14_SHA256 = "0daad3c5eccba83a92653c4442e12ffd547aa76abcf9fc6e3a9c2a717302f162"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_builder():
    spec = importlib.util.spec_from_file_location("v15_text_builder", BUILDER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load text builder")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    builder = load_builder()
    source = builder.load_source()
    stories, story_manifest = builder.load_story_layers(source)
    text = DOC.read_text(encoding="utf-8")
    failures = []

    counts = {
        "chapters": len(re.findall(r"^# 第[一二三四五六七八九十]+章", text, re.MULTILINE)),
        "supplements": len(re.findall(r"^## 补充 \d+\.\d+", text, re.MULTILINE)),
        "dialogue_turns": len(re.findall(r"^> \*\*[^*]+：\*\* ", text, re.MULTILINE)),
        "beginner_sections": len(re.findall(r"^#{2,3} (?:3\. )?小白一句话$", text, re.MULTILINE)),
        "analogy_sections": len(re.findall(r"^#{2,3} (?:4\. )?像什么$", text, re.MULTILINE)),
        "technical_sections": len(re.findall(r"^#{2,3} (?:6\. )?技术真相$", text, re.MULTILINE)),
        "code_blocks": text.count("```go"),
        "all_fences": text.count("```"),
    }
    expected = {
        "chapters": 24,
        "supplements": 47,
        "dialogue_turns": story_manifest["story_dialogue_turns"],
        "beginner_sections": 71,
        "analogy_sections": 71,
        "technical_sections": 71,
        "code_blocks": 64,
        "all_fences": 128,
    }
    for key, value in expected.items():
        if counts[key] != value:
            failures.append(f"{key}: expected {value}, got {counts[key]}")

    chapter_one = text.split("# 第二章", 1)[0]
    stale_chapter_one_terms = [term for term in ("splitAmount", "quotient", "remainder", "商和余数") if term in chapter_one]
    if stale_chapter_one_terms:
        failures.append(f"chapter 1 retained rejected split example: {stale_chapter_one_terms}")
    if "水断在上游" in text:
        failures.append("stale SSE cancellation hint returned")

    rejected_contract_phrases = {
        "创建回 201、输入错回 400": "chapter 9 collapsed 400 and 422",
        "tenant、owner、动作和请求指纹": "chapter 11 added owner to the idempotency scope",
        "固定 Worker 数和队列上限": "chapter 13 confused the concurrency gate with a worker pool",
        "有界 Worker 已把 BillCreated": "chapter 13 transition confused the gate with a worker pool",
        "队满可在 deadline 内阻塞": "chapter 13 gate self-check retained queue strategies",
        "外层统一 retry budget": "beginner dialogue retained avoidable retry jargon",
        "approval 与 budget 预留": "beginner dialogue retained avoidable budget jargon",
    }
    for phrase, reason in rejected_contract_phrases.items():
        if phrase in text:
            failures.append(reason)

    test_section = text.split("## 补充 1.2", 1)[1].split("---", 1)[0]
    if "**Run**：从开始到结束的一整趟任务" in test_section:
        failures.append("t.Run was misclassified as Harness Run")

    all_turns = []
    dense_turns = []
    for kind in ("chapters", "supplements"):
        for unit_id, item in stories[kind].items():
            for index, (speaker, turn) in enumerate(item["dialogue"], 1):
                all_turns.append(turn)
                latin = re.findall(r"[A-Za-z][A-Za-z0-9_.-]*", turn)
                if len(latin) >= 4:
                    dense_turns.append({
                        "kind": kind[:-1], "id": unit_id, "turn": index,
                        "speaker": speaker, "latin_terms": len(latin), "text": turn,
                    })
    duplicate_turns = [turn for turn, count in collections.Counter(all_turns).items() if count > 1]
    if duplicate_turns:
        failures.append(f"duplicate story turns: {len(duplicate_turns)}")

    v14_sha = sha256(V14_PDF)
    if v14_sha != EXPECTED_V14_SHA256:
        failures.append(f"v14 PDF changed: {v14_sha}")

    payload = {
        "status": "pass" if not failures else "fail",
        "output_sha256": sha256(DOC),
        "v14_pdf_sha256": v14_sha,
        "counts": counts,
        "story_manifest": story_manifest,
        "dense_dialogue_warnings": dense_turns,
        "duplicate_turns": duplicate_turns,
        "stale_chapter_one_terms": stale_chapter_one_terms,
        "failures": failures,
    }
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": payload["status"], "counts": counts,
        "dense_dialogue_warnings": len(dense_turns), "failures": failures,
    }, ensure_ascii=False))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
