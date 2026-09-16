from __future__ import annotations

import collections
import json
from pathlib import Path


PROJECT = Path(__file__).resolve().parent
STORY_FILES = (
    PROJECT / "manuscript" / "story-go.json",
    PROJECT / "manuscript" / "story-backend.json",
    PROJECT / "manuscript" / "story-harness.json",
)
OUT = PROJECT / "evidence" / "dialogue-quality-v16.json"


def main() -> None:
    units = []
    for path in STORY_FILES:
        payload = json.loads(path.read_text(encoding="utf-8"))
        for kind in ("chapters", "supplements"):
            for unit_id, item in payload[kind].items():
                units.append((path.name, kind[:-1], unit_id, item))

    rendered = json.loads((PROJECT / "interactive" / "data" / "book.json").read_text(encoding="utf-8"))
    rendered_units = rendered["chapters"] + [item for chapter in rendered["chapters"] for item in chapter["supplements"]]
    starts = collections.Counter(item["dialogue"][0]["speaker"] for item in rendered_units)
    ends = collections.Counter(item["dialogue"][-1]["speaker"] for item in rendered_units)
    turns = [(turn["speaker"], turn["text"]) for item in rendered_units for turn in item["dialogue"]]
    speakers = collections.Counter(speaker for speaker, _ in turns)
    exact_duplicates = [text for text, count in collections.Counter(text for _, text in turns).items() if count > 1]
    mechanical = []
    consecutive_chen = []
    consecutive_speaker = []
    malformed = []

    for source, kind, unit_id, item in units:
        dialogue = item.get("dialogue", [])
        if len(item.get("opening", [])) != 2 or not 4 <= len(dialogue) <= 6 or not item.get("closing"):
            malformed.append(f"{source}:{kind}:{unit_id}")
        if dialogue and dialogue[0][0] == "陈平安" and dialogue[-1][0] == "宁姚":
            mechanical.append(f"{source}:{kind}:{unit_id}")
    for item in rendered_units:
        dialogue = item.get("dialogue", [])
        for index in range(len(dialogue) - 1):
            if dialogue[index]["speaker"] == dialogue[index + 1]["speaker"] == "陈平安":
                consecutive_chen.append(f"{item['id']}:{index + 1}")
            if dialogue[index]["speaker"] == dialogue[index + 1]["speaker"]:
                consecutive_speaker.append(f"{item['id']}:{index + 1}")

    total = len(units)
    failures = []
    if total != 71:
        failures.append(f"expected 71 units, got {total}")
    if starts["陈平安"] > total * 0.45:
        failures.append(f"Chen starts too many units: {starts['陈平安']}/{total}")
    if ends["宁姚"] > total * 0.45:
        failures.append(f"Ning ends too many units: {ends['宁姚']}/{total}")
    if len(mechanical) > total * 0.20:
        failures.append(f"fixed Chen-to-Ning template remains: {len(mechanical)}/{total}")
    if consecutive_chen:
        failures.append(f"consecutive Chen explanation turns: {len(consecutive_chen)}")
    if consecutive_speaker:
        failures.append(f"consecutive same-speaker turns: {len(consecutive_speaker)}")
    if malformed:
        failures.append(f"malformed story units: {len(malformed)}")
    if exact_duplicates:
        failures.append(f"duplicate dialogue lines: {len(exact_duplicates)}")
    long_lines = [(speaker, text) for speaker, text in turns if len(text) > 40]
    if long_lines:
        failures.append(f"dialogue lines exceed 40 characters: {len(long_lines)}")
    if any(count > len(turns) * 0.24 for count in speakers.values()):
        failures.append("one speaker exceeds 24% of rendered dialogue")
    second_chen = sum(len(item["dialogue"]) > 1 and item["dialogue"][1]["speaker"] == "陈平安" for item in rendered_units)
    if second_chen > total * 0.20:
        failures.append(f"Chen occupies too many second turns: {second_chen}/{total}")
    introduced_ellipsis = [(speaker, text) for speaker, text in turns if "…" in text]
    if introduced_ellipsis:
        failures.append(f"dialogue contains literal ellipsis: {len(introduced_ellipsis)}")
    rhythm = collections.Counter(len(item["dialogue"]) for item in rendered_units)

    payload = {
        "status": "pass" if not failures else "fail",
        "units": total,
        "turns": len(turns),
        "starts": starts,
        "ends": ends,
        "speakers": speakers,
        "fixed_template_units": mechanical,
        "consecutive_chen": consecutive_chen,
        "consecutive_speaker": consecutive_speaker,
        "duplicate_lines": exact_duplicates,
        "long_lines": long_lines,
        "second_turn_chen": second_chen,
        "literal_ellipsis": introduced_ellipsis,
        "rhythm": rhythm,
        "malformed_units": malformed,
        "failures": failures,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
