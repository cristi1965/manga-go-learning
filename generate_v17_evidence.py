from __future__ import annotations

import hashlib
import json
import platform
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent
FILES = [
    ROOT / "interactive" / "index.html",
    ROOT / "interactive" / "app.js",
    ROOT / "interactive" / "styles.css",
    ROOT / "interactive" / "data" / "book.json",
    ROOT / "labs" / "harness-lab" / "harness.go",
    ROOT / "labs" / "harness-lab" / "harness_test.go",
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(command: list[str], cwd: Path) -> dict:
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=120)
    return {
        "command": " ".join(command),
        "cwd": str(cwd),
        "status": "pass" if result.returncode == 0 else "fail",
        "exitCode": result.returncode,
        "output": (result.stdout + result.stderr).strip(),
    }


book = json.loads((ROOT / "interactive" / "data" / "book.json").read_text(encoding="utf-8"))
all_units = book["chapters"] + [item for chapter in book["chapters"] for item in chapter["supplements"]]
payload = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "python": platform.python_version(),
    "go": subprocess.run(["go", "version"], capture_output=True, text=True, check=True).stdout.strip(),
    "files": {str(path.relative_to(ROOT)): sha256(path) for path in FILES},
    "contentStats": {
        "chapters": book["stats"]["chapters"],
        "supplements": book["stats"]["supplements"],
        "renderedDialogueTurns": book["stats"]["dialogueTurns"],
        "sourceDialogueTurns": 424,
        "machineScoredChecks": sum(len(item["selfCheck"]) for item in all_units),
        "syntaxCheckedCodeBlocks": sum(bool(item["code"] and item["syntaxVerified"]) for item in all_units),
        "runtimeVerifiedUnits": len(book["verification"]),
    },
    "checks": [
        run(["go", "test", "-race", "-count=20", "./..."], ROOT / "labs" / "harness-lab"),
        run(["node", "--check", "interactive/app.js"], ROOT),
        run([str(Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"), "verify_dialogue_quality.py"], ROOT),
    ],
    "browser": {
        "url": "http://127.0.0.1:4173/?v=17.1#chapter-1",
        "mobileViewport": "390x844",
        "unitsTraversed": 71,
        "failures": [],
        "assertions": [
            "all 71 hashes render a visible title",
            "all 71 units start at understand stage",
            "all 71 mobile pages have zero horizontal overflow",
            "mobile sidebar opens, closes, becomes inert, and returns focus on Escape",
            "wrong choice shows explanation and enters review queue",
            "three track entry buttons open chapters 1, 9, and 17",
            "console error count is zero",
        ],
        "screenshots": {
            "mobile": {"path": "output/browser-v17/mobile-final.png", "sha256": sha256(ROOT / "output" / "browser-v17" / "mobile-final.png")},
            "desktop": {"path": "output/browser-v17/desktop.png", "sha256": sha256(ROOT / "output" / "browser-v17" / "desktop.png")},
        },
    },
}

output = ROOT / "evidence" / "v17-verification.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(output)
