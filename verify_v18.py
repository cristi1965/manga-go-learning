from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import socket
import subprocess
import sys
import shutil
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "evidence" / "v18-engineering-acceptance.json"
def find_node() -> Path:
    if "MANGA_GO_NODE" in os.environ:
        return Path(os.environ["MANGA_GO_NODE"])
    codex_node = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
    if codex_node.is_file():
        return codex_node
    nvm_dir = Path.home() / ".nvm/versions/node"
    if nvm_dir.is_dir():
        for ver in ("v24", "v22", "v20", "v18"):
            candidates = sorted(nvm_dir.glob(f"{ver}*/bin/node"), reverse=True)
            if candidates and candidates[0].is_file():
                return candidates[0]
    return Path(shutil.which("node") or "node")

NODE = find_node()


def run(command: list[str], cwd: Path = ROOT, timeout: int = 90) -> dict:
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f"{' '.join(command)} failed:\n{result.stdout}\n{result.stderr}")
    return {"command": " ".join(command), "status": "pass"}


def request(url: str, payload: bytes | None = None, *, origin: str | None = None, content_type: str = "application/json") -> tuple[int, dict]:
    headers = {"Content-Type": content_type} if payload is not None else {}
    if origin:
        headers["Origin"] = origin
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST" if payload is not None else "GET")
    try:
        response = urllib.request.urlopen(req, timeout=70)
    except urllib.error.HTTPError as error:
        response = error
    return response.status, json.loads(response.read().decode("utf-8"))


def post(base: str, path: str, value: object, **kwargs) -> tuple[int, dict]:
    return request(base + path, json.dumps(value, ensure_ascii=False).encode("utf-8"), **kwargs)


def load_solutions() -> tuple[dict, dict]:
    spec = importlib.util.spec_from_file_location("manga_build", ROOT / "build_html.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module.GO_PRACTICE_SOLUTIONS, {
        unit_id: exercise["solution"]
        for unit_id, exercise in module.GO_AI_PROJECT_PRACTICES.items()
    }


def main() -> None:
    checks = [
        run([sys.executable, "build_html.py"]),
        run(["go", "test", "./..."], ROOT / "runner"),
        run(["go", "test", "-race", "-shuffle=on", "-count=20", "./..."], ROOT / "labs" / "harness-lab"),
        run(["go", "test", "-race", "./..."], ROOT / "labs" / "ledger-agent"),
        run([sys.executable, "verify_dialogue_quality.py"]),
    ]
    book = json.loads((ROOT / "interactive" / "data" / "book.json").read_text(encoding="utf-8"))
    if book["version"] != (ROOT / "VERSION").read_text(encoding="utf-8").strip():
        raise RuntimeError("VERSION and book.json disagree")
    if len(book["chapters"]) != 24 or any("workshop" not in chapter for chapter in book["chapters"]):
        raise RuntimeError("24/24 chapter workshops are required")
    if sum("codeExercise" in chapter["workshop"] for chapter in book["chapters"]) != 24:
        raise RuntimeError("all 24 chapters must have code exercises")
    if any(len(chapter["workshop"]["codeExercise"].get("hints", [])) != 3 for chapter in book["chapters"]):
        raise RuntimeError("every code exercise requires three progressive hints")
    if any(not chapter["workshop"]["codeExercise"].get("testIntent") for chapter in book["chapters"]):
        raise RuntimeError("every code exercise must explain its fixed-test intent")
    if any(not chapter["learning"].get("readingMinutes") or not chapter["learning"].get("practiceMinutes") for chapter in book["chapters"]):
        raise RuntimeError("reading and practice time must be separated")
    if "1-8" not in book["chapters"][8]["learning"]["prerequisite"] or "1-16" not in book["chapters"][16]["learning"]["prerequisite"]:
        raise RuntimeError("volume prerequisites must be explicit")
    if "capstone" not in book["chapters"][23]["workshop"]:
        raise RuntimeError("chapter 24 capstone is required")
    supplements = [item for chapter in book["chapters"] for item in chapter["supplements"]]
    required_supplement_fields = {"id", "chapter", "title", "kicker", "opening", "dialogue", "closing", "analogy", "glossary", "principles", "task", "accept", "selfCheck", "volume", "learning"}
    incomplete = [item.get("id", "<missing>") for item in supplements if required_supplement_fields - set(item)]
    if incomplete:
        raise RuntimeError(f"supplements violate the rendered data contract: {incomplete}")
    project_units = [item for item in supplements if item.get("projectLab")]
    if len(project_units) != 8 or any(not item["projectLab"]["id"].startswith("ledger-agent-lab/") for item in project_units):
        raise RuntimeError("eight continuous ledger-agent milestones are required")
    if any(not item.get("projectExercise") for item in project_units):
        raise RuntimeError("every ledger-agent milestone requires a learner coding challenge")
    if any(len(item["projectExercise"].get("hints", [])) != 3 or not item["projectExercise"].get("testIntent") for item in project_units):
        raise RuntimeError("every ledger-agent challenge requires test intent and three progressive hints")
    if any(len(quiz.get("feedback", [])) != len(quiz.get("choices", [])) for item in supplements for quiz in item["selfCheck"]):
        raise RuntimeError("every supplement misconception choice requires feedback")
    if any(entry["term"] == "Run" for entry in book["chapters"][0]["glossary"]):
        raise RuntimeError("chapter 1 introduces Run before it is used")
    supplement_positions = [quiz["correctIndex"] for item in supplements for quiz in item["selfCheck"]]
    if set(supplement_positions) != {0, 1, 2} or len(set(supplement_positions)) < 3:
        raise RuntimeError("supplement quiz correct positions are not distributed")
    if any(all(option.startswith("跳过") or option.startswith("只") for option in quiz["choices"][1:]) for item in supplements for quiz in item["selfCheck"]):
        raise RuntimeError("supplement distractors are merely procedural negations")

    with tempfile.TemporaryDirectory(prefix="manga-go-v18-") as tmp:
        tmp_path = Path(tmp)
        binary = tmp_path / "runner"
        run(["go", "build", "-o", str(binary), "."], ROOT / "runner")
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        env = os.environ | {"MANGA_GO_ADDR": f"127.0.0.1:{port}", "MANGA_GO_HOST_SECRET": "must-not-leak"}
        process = subprocess.Popen([str(binary)], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        base = f"http://127.0.0.1:{port}"
        try:
            for _ in range(80):
                try:
                    status, health = request(base + "/api/health")
                    if status == 200:
                        break
                except OSError:
                    time.sleep(0.1)
            else:
                raise RuntimeError("runner did not become healthy")
            if health["version"] != book["version"] or Path(health["root"]) != ROOT:
                raise RuntimeError(f"wrong runner provenance: {health}")

            api = []
            status, body = post(base, "/api/run", {"unitId": "chapter-1", "code": 'package main\nimport "fmt"\nfunc main(){fmt.Println("ok")}\n'})
            api.append({"case": "valid", "status": status, "ok": body.get("ok"), "output": body.get("output", "")})
            status, _ = post(base, "/api/run", {"unitId": "chapter-1"}, origin="https://evil.example")
            api.append({"case": "cross-origin", "status": status})
            raw = b'{"unitId":"chapter-1"} trailing'
            status, _ = request(base + "/api/run", raw)
            api.append({"case": "trailing-json", "status": status})
            status, _ = post(base, "/api/run", {"unitId": "chapter-1", "code": "x" * 70000})
            api.append({"case": "oversized", "status": status})
            status, _ = request(base + "/api/run", b'{"unitId":"chapter-1"}', content_type="text/plain")
            api.append({"case": "wrong-content-type", "status": status})
            child_process = 'package main\nimport "os/exec"\nfunc main(){_ = exec.Command("sh","-c","echo child").Run()}\n'
            status, body = post(base, "/api/run", {"unitId": "chapter-1", "code": child_process})
            api.append({"case": "child-process-import", "status": status, "output": body.get("output", "")})
            start_process = 'package main\nimport "os"\nfunc main(){_,_ = os.StartProcess("/bin/echo",[]string{"echo","child"},&os.ProcAttr{})}\n'
            status, body = post(base, "/api/run", {"unitId": "chapter-1", "code": start_process})
            api.append({"case": "start-process", "status": status, "output": body.get("output", "")})
            host_read = 'package main\nimport("fmt";"os")\nfunc main(){_,e:=os.ReadFile("/etc/hosts");fmt.Println(e!=nil)}\n'
            status, body = post(base, "/api/run", {"unitId": "chapter-1", "code": host_read})
            api.append({"case": "host-file-read", "status": status, "output": body.get("output", "").strip()})
            large_file = 'package main\nimport "os"\nfunc main(){f,_:=os.Create("large");defer f.Close();b:=make([]byte,1024*1024);for i:=0;i<256;i++{if _,e:=f.Write(b);e!=nil{panic(e)}}}\n'
            status, _ = post(base, "/api/run", {"unitId": "chapter-1", "code": large_file})
            api.append({"case": "file-limit", "status": status})
            host_config_path = Path.home() / ".ssh" / "config"
            if not host_config_path.is_file() or not os.access(host_config_path, os.R_OK):
                raise RuntimeError("host SSH config must be readable outside the sandbox for this isolation test")
            host_config = json.dumps(str(host_config_path))
            isolation = f'package main\nimport("fmt";"net";"os")\nfunc main(){{_,a:=os.ReadFile({host_config});_,b:=net.Dial("tcp","example.com:80");fmt.Println(a!=nil,b!=nil)}}\n'
            status, body = post(base, "/api/run", {"unitId": "chapter-1", "code": isolation})
            api.append({"case": "sandbox", "status": status, "output": body.get("output", "").strip()})
            symlink = f'package main\nimport("fmt";"os")\nfunc main(){{_ = os.Symlink({host_config},"link");_,err:=os.ReadFile("link");fmt.Println(err!=nil)}}\n'
            status, body = post(base, "/api/run", {"unitId": "chapter-1", "code": symlink})
            api.append({"case": "symlink-home-read", "status": status, "output": body.get("output", "").strip()})
            env_secret = 'package main\nimport("fmt";"os")\nfunc main(){fmt.Println(os.Getenv("MANGA_GO_HOST_SECRET")=="")}\n'
            status, body = post(base, "/api/run", {"unitId": "chapter-1", "code": env_secret})
            api.append({"case": "host-env-secret", "status": status, "output": body.get("output", "").strip()})
            noisy = 'package main\nimport("fmt";"strings")\nfunc main(){fmt.Print(strings.Repeat("x",1000000))}\n'
            status, body = post(base, "/api/run", {"unitId": "chapter-1", "code": noisy})
            api.append({"case": "bounded-output", "status": status, "outputBytes": len(body.get("output", "").encode("utf-8")), "truncated": "输出过长" in body.get("output", "")})
            timeout_code = 'package main\nfunc main(){for{}}\n'
            status, body = post(base, "/api/run", {"unitId": "chapter-1", "code": timeout_code})
            api.append({"case": "timeout", "status": status, "message": body.get("output")})
            solutions, project_solutions = load_solutions()
            solved_proofs = {}
            for index in range(1, 25):
                starter = book["chapters"][index - 1]["workshop"]["codeExercise"]["code"]
                starter_status, _ = post(base, "/api/run", {"unitId": f"exercise-chapter-{index}", "code": starter})
                solved_status, solved = post(base, "/api/run", {"unitId": f"exercise-chapter-{index}", "code": solutions[index]})
                solved_proofs[index] = solved
                api.append({"case": f"exercise-{index}", "starterStatus": starter_status, "solutionStatus": solved_status, "digest": solved.get("artifactDigest"), "runProof": bool(solved.get("runProof"))})
            project_proofs = {}
            for project in project_units:
                unit_id = project["id"]
                starter_status, _ = post(base, "/api/run", {"unitId": f"exercise-{unit_id}", "code": project["projectExercise"]["code"]})
                solved_status, solved = post(base, "/api/run", {"unitId": f"exercise-{unit_id}", "code": project_solutions[unit_id]})
                lab_status, lab = post(base, "/api/run", {"unitId": project["projectLab"]["id"], "code": project_solutions[unit_id]})
                project_proofs[unit_id] = {"challenge": solved, "lab": lab}
                milestone_number = unit_id.rsplit("-", 1)[-1]
                lab_output = lab.get("output", "")
                api.append({"case": f"project-exercise-{unit_id}", "starterStatus": starter_status, "solutionStatus": solved_status, "labStatus": lab_status, "digest": solved.get("artifactDigest"), "runProof": bool(solved.get("runProof")), "labProof": bool(lab.get("runProof")), "milestoneTestPassed": f"--- PASS: TestMilestone{milestone_number}" in lab_output, "learnerContractPassed": f"--- PASS: TestLearner{milestone_number}" in lab_output})
            rubrics = json.loads((ROOT / "runner" / "rubrics.json").read_text(encoding="utf-8"))
            for index, chapter in enumerate(book["chapters"], 1):
                if chapter["id"] in rubrics:
                    expected = [decision[0] for decision in rubrics[chapter["id"]]]
                else:
                    expected = [chapter[key] for key in ("goal", "task", "accept")]
                status, body = post(base, "/api/check", {"unitId": chapter["id"], "answers": expected})
                api.append({"case": f"workshop-{index}-pass", "status": status, "digest": body.get("artifactDigest")})
                status, _ = post(base, "/api/check", {"unitId": chapter["id"], "answers": ["错", "错", "错"]})
                api.append({"case": f"workshop-{index}-fail", "status": status})

            chapter = book["chapters"][0]
            completion_payload = {
                "unitId": chapter["id"],
                "answers": [chapter[key] for key in ("goal", "task", "accept")],
                "quizAnswers": [quiz["correctIndex"] for quiz in chapter["selfCheck"]],
                "codeDigest": solved_proofs[1]["artifactDigest"],
                "runProof": solved_proofs[1]["runProof"],
            }
            status, body = post(base, "/api/check", completion_payload)
            api.append({"case": "completion-valid", "status": status, "digest": body.get("completionDigest")})
            for case, changes in (
                ("completion-empty-proof", {"runProof": ""}),
                ("completion-forged-proof", {"runProof": "run:forged-never-ran"}),
                ("completion-cross-unit-proof", {"runProof": solved_proofs[2]["runProof"]}),
                ("completion-tampered-digest", {"codeDigest": "sha256:forged"}),
            ):
                payload = completion_payload | changes
                status, _ = post(base, "/api/check", payload)
                api.append({"case": case, "status": status})

            project = project_units[0]
            project_id = project["id"]
            project_evidence = project_proofs[project_id]
            project_completion = {
                "unitId": project_id,
                "quizAnswers": [quiz["correctIndex"] for quiz in project["selfCheck"]],
                "codeDigest": project_evidence["lab"]["artifactDigest"],
                "runProof": project_evidence["lab"]["runProof"],
                "challengeDigest": project_evidence["challenge"]["artifactDigest"],
                "challengeRunProof": project_evidence["challenge"]["runProof"],
            }
            status, body = post(base, "/api/check", project_completion)
            api.append({"case": "project-completion-valid", "status": status, "digest": body.get("completionDigest")})
            for case, changes in (
                ("project-completion-no-challenge", {"challengeRunProof": ""}),
                ("project-completion-forged-challenge", {"challengeRunProof": "run:forged"}),
                ("project-completion-cross-unit-challenge", {"challengeRunProof": project_proofs[project_units[1]["id"]]["challenge"]["runProof"]}),
                ("project-completion-tampered-lab", {"codeDigest": "sha256:forged"}),
            ):
                status, _ = post(base, "/api/check", project_completion | changes)
                api.append({"case": case, "status": status})

            expected_status = {"valid": 200, "cross-origin": 403, "trailing-json": 400, "oversized": 413, "wrong-content-type": 415, "child-process-import": 422, "start-process": 422, "host-file-read": 200, "file-limit": 422, "sandbox": 200, "symlink-home-read": 200, "host-env-secret": 200, "bounded-output": 200, "timeout": 422}
            for item in api:
                if item["case"].startswith("project-exercise-"):
                    if item["starterStatus"] == 200 or item["solutionStatus"] != 200 or item["labStatus"] != 200 or not item["digest"] or not item["runProof"] or not item["labProof"] or not item["milestoneTestPassed"] or not item["learnerContractPassed"]:
                        raise RuntimeError(f"project exercise gate failed: {item}")
                elif item["case"].startswith("exercise-"):
                    if item["starterStatus"] == 200 or item["solutionStatus"] != 200 or not item["digest"] or not item["runProof"]:
                        raise RuntimeError(f"exercise gate failed: {item}")
                elif item["case"].startswith("workshop-"):
                    want = 200 if item["case"].endswith("-pass") else 422
                    if item["status"] != want or (want == 200 and not item["digest"]):
                        raise RuntimeError(f"workshop gate failed: {item}")
                elif item["case"] == "completion-valid":
                    if item["status"] != 200 or not item["digest"]:
                        raise RuntimeError(f"completion gate failed: {item}")
                elif item["case"].startswith("completion-"):
                    if item["status"] != 422:
                        raise RuntimeError(f"completion proof bypassed: {item}")
                elif item["case"] == "project-completion-valid":
                    if item["status"] != 200 or not item["digest"]:
                        raise RuntimeError(f"project completion gate failed: {item}")
                elif item["case"].startswith("project-completion-"):
                    if item["status"] != 422:
                        raise RuntimeError(f"project completion proof bypassed: {item}")
                elif item["status"] != expected_status[item["case"]]:
                    raise RuntimeError(f"API gate failed: {item}")
            if next(item for item in api if item["case"] == "sandbox")["output"] != "true true":
                raise RuntimeError("sandbox did not deny both home read and network")
            if next(item for item in api if item["case"] == "symlink-home-read")["output"] != "true":
                raise RuntimeError("sandbox allowed a symlink read into home")
            if next(item for item in api if item["case"] == "host-env-secret")["output"] != "true":
                raise RuntimeError("runner exposed a host environment secret")
            if "禁止导入" not in next(item for item in api if item["case"] == "child-process-import")["output"]:
                raise RuntimeError("source policy did not explain the child-process rejection")
            if "禁止创建子进程" not in next(item for item in api if item["case"] == "start-process")["output"]:
                raise RuntimeError("source policy did not reject os.StartProcess")
            if next(item for item in api if item["case"] == "host-file-read")["output"] != "true":
                raise RuntimeError("sandbox allowed reading /etc/hosts")
            bounded = next(item for item in api if item["case"] == "bounded-output")
            if not bounded["truncated"] or bounded["outputBytes"] > 34000:
                raise RuntimeError(f"output was not bounded: {bounded}")
            if "已停止" not in next(item for item in api if item["case"] == "timeout")["message"]:
                raise RuntimeError("timeout process was not stopped")
            browser_run = subprocess.run(
                [str(NODE), "browser_audit.mjs"], cwd=ROOT,
                env=os.environ | {"MANGA_GO_URL": base}, capture_output=True, text=True, timeout=180,
            )
            if browser_run.returncode:
                raise RuntimeError(f"browser audit failed:\n{browser_run.stdout}\n{browser_run.stderr}")
            checks.append({"command": "node browser_audit.mjs", "status": "pass"})
            learning_run = subprocess.run(
                [str(NODE), "enterprise_learning_audit.mjs"], cwd=ROOT,
                env=os.environ | {"MANGA_GO_URL": base, "MANGA_GO_PROJECT_SOLUTION": project_solutions["supplement-go-ai-01"]}, capture_output=True, text=True, timeout=240,
            )
            if learning_run.returncode:
                raise RuntimeError(f"enterprise learning audit failed:\n{learning_run.stdout}\n{learning_run.stderr}")
            checks.append({"command": "node enterprise_learning_audit.mjs", "status": "pass"})
        finally:
            process.terminate()
            process.wait(timeout=5)

    browser_evidence = json.loads((ROOT / "evidence" / "browser-v18.json").read_text(encoding="utf-8"))
    if browser_evidence.get("status") != "pass" or browser_evidence.get("version") != book["version"]:
        raise RuntimeError("browser evidence is missing or stale")
    browser_bound = ["VERSION", "interactive/index.html", "interactive/app.js", "interactive/styles.css", "interactive/data/book.json", "runner/main.go", "browser_audit.mjs", "package.json", "package-lock.json"]
    expected_artifacts = {path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in browser_bound}
    if browser_evidence.get("artifactSha256") != expected_artifacts:
        raise RuntimeError("browser evidence is not bound to the current application artifacts")
    expected_units = len(book["chapters"]) + len(supplements)
    if browser_evidence.get("units") != expected_units or browser_evidence.get("consoleErrors") or browser_evidence.get("pageErrors") or browser_evidence.get("requestFailures"):
        raise RuntimeError("browser coverage or console acceptance failed")
    if len(browser_evidence.get("expectedConsoleErrors", [])) != 2:
        raise RuntimeError("browser negative-request console evidence changed unexpectedly")
    expected_unit_list = []
    for chapter in book["chapters"]:
        expected_unit_list.append({"id": chapter["id"], "kind": "chapter"})
        expected_unit_list.extend({"id": item["id"], "kind": "supplement"} for item in chapter["supplements"])
    for surface in ("desktop", "mobile", "darkMobile"):
        units = browser_evidence.get(surface, {}).get("units", [])
        if len(units) != expected_units:
            raise RuntimeError(f"browser {surface} did not cover all {expected_units} units")
        if [{"id": item.get("id"), "kind": item.get("kind")} for item in units] != expected_unit_list:
            raise RuntimeError(f"browser {surface} unit identities do not match book.json")
        for item in units:
            expected_workshops = 1 if item["kind"] == "chapter" else 0
            if item.get("axeStages") != ["understand", "practice"] or not item.get("axeExecuted") or item["overflow"] or item["badControls"] or item["badImages"] or item["duplicateIds"] or item["minControl"] < 44 or item["workshops"] != expected_workshops:
                raise RuntimeError(f"browser {surface} acceptance failed: {item}")
    accessibility = browser_evidence.get("accessibility", {})
    keyboard = accessibility.get("keyboard", {})
    if accessibility.get("axeViolations"):
        raise RuntimeError(f"axe accessibility acceptance failed: {accessibility['axeViolations']}")
    if accessibility.get("darkAxeViolations"):
        raise RuntimeError(f"dark-mode axe accessibility acceptance failed: {accessibility['darkAxeViolations']}")
    if accessibility.get("reflow200Percent", {}).get("overflow") or not accessibility.get("reflow200Percent", {}).get("menuVisible"):
        raise RuntimeError("browser 200 percent reflow acceptance failed")
    expected_keyboard = {"sidebarOpen": True, "escapeFocus": "menuToggle", "dialogOpen": True, "dialogClosed": True}
    if any(keyboard.get(key) != value for key, value in expected_keyboard.items()) or not accessibility.get("reducedMotion"):
        raise RuntimeError("browser keyboard or reduced-motion acceptance failed")
    expected_learning_path = ["stage-read", "flow-node", "technical-details", "stage-practice", "code-editor", "run-code", "quiz-choice", "workshop-field", "complete"]
    learning_path = keyboard.get("learningPath", [])
    if [item.get("name") for item in learning_path] != expected_learning_path or not all(item.get("focusVisible") for item in learning_path):
        raise RuntimeError(f"browser keyboard learning path acceptance failed: {learning_path}")
    if accessibility.get("programmaticHeadingOutline") != "none":
        raise RuntimeError("programmatic chapter focus has a visible box outline")
    if not browser_evidence.get("runtime", {}).get("browserVersion"):
        raise RuntimeError("browser runtime version was not recorded")
    interactions = browser_evidence.get("interactions", {})
    if not all(interactions.get("structuredWorkshop", {}).values()) or not all(interactions.get("staleResponse", {}).values()) or not all(interactions.get("forgedLocalStorage", {}).values()):
        raise RuntimeError("browser interaction acceptance failed")
    for screenshot in browser_evidence.get("screenshots", {}).values():
        actual = hashlib.sha256((ROOT / screenshot["path"]).read_bytes()).hexdigest()
        if actual != screenshot["sha256"]:
            raise RuntimeError(f"stale screenshot: {screenshot['path']}")

    tracked = ["VERSION", "build_html.py", "verify_v18.py", "verify-v18.sh", "interactive/index.html", "interactive/app.js", "interactive/styles.css", "interactive/data/book.json", "runner/main.go", "runner/main_test.go", "runner/exercises.json", "runner/rubrics.json", "labs/harness-lab/go.mod", "labs/harness-lab/harness.go", "labs/harness-lab/harness_test.go", "browser_audit.mjs", "enterprise_learning_audit.mjs", "package.json", "package-lock.json", "evidence/browser-v18.json"]
    tracked += sorted(str(path.relative_to(ROOT)) for path in (ROOT / "labs" / "ledger-agent").rglob("*") if path.is_file())
    hashes = {path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in tracked}
    report = {"status": "pass", "claim": "engineering acceptance", "score": 100, "version": book["version"], "generatedAt": datetime.now(timezone.utc).isoformat(), "environment": {"python": sys.version.split()[0], "go": subprocess.check_output(["go", "version"], text=True).strip(), "platform": sys.platform, "runnerPort": port, "runnerPid": process.pid}, "checks": checks, "api": api, "coverage": {"chapters": 24, "supplements": len(supplements), "projectMilestones": len(project_units), "workshopsPositive": 24, "workshopsNegative": 24, "codeExercises": 24 + len(project_units), "dialogueTurns": book["stats"]["dialogueTurns"]}, "sha256": hashes}
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "pass", "score": 100, "report": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
