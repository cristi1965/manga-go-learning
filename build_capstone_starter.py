#!/usr/bin/env python3
import os
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LAB_DIR = ROOT / "labs" / "ledger-agent"
OUT_DIR = ROOT / "interactive" / "downloads"
ZIP_PATH = OUT_DIR / "ledger-agent-starter.zip"

MAKEFILE_CONTENT = """# Ledger Agent Capstone Makefile
.PHONY: test race eval run clean

test:
	go test ./...

race:
	go test -race ./...

eval:
	go run ./cmd/server eval

run:
	go run ./cmd/server

clean:
	go clean
"""

VERIFY_SH_CONTENT = """#!/bin/sh
set -eu
echo "========================================="
echo "  Ledger Agent 企业级作品集全链路验收"
echo "========================================="

echo "[1/3] 运行单元测试..."
go test ./...

echo "[2/3] 运行高并发竞态检测 (-race)..."
go test -race ./...

echo "[3/3] 运行离线安全评测门禁 (Eval)..."
go run ./cmd/server eval

echo ""
echo ">>> 全部验收通过！恭喜完成 Go + AI 企业级工程作品集！<<<"
"""

def build_starter_zip() -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # Add all files from labs/ledger-agent
        for file_path in sorted(LAB_DIR.rglob("*")):
            if file_path.is_file():
                rel_path = file_path.relative_to(LAB_DIR)
                # Prefix inside zip with ledger-agent-starter/
                arc_name = Path("ledger-agent-starter") / rel_path
                zf.write(file_path, arc_name)
        
        # Add root Makefile
        zf.writestr("ledger-agent-starter/Makefile", MAKEFILE_CONTENT)
        # Add root verify.sh
        zinfo = zipfile.ZipInfo("ledger-agent-starter/verify.sh")
        zinfo.external_attr = 0o755 << 16  # rwxr-xr-x
        zf.writestr(zinfo, VERIFY_SH_CONTENT)
        
    return ZIP_PATH

if __name__ == "__main__":
    out = build_starter_zip()
    print(f"Generated starter zip at: {out} ({out.stat().st_size} bytes)")
