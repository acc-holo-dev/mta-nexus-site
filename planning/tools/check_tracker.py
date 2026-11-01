"""Validate the active JSON-in-repo working tracker (DOC-03)."""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "planning"
BASELINE = PLAN / "import-baseline"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf8"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", type=Path, default=ROOT)
    args = ap.parse_args()
    repo = args.repo.resolve()
    plan = repo / "planning"
    baseline = plan / "import-baseline"
    problems: list[str] = []
    checks: list[str] = []

    def require(cond: bool, msg: str) -> None:
        if not cond:
            problems.append(msg)

    data = load(plan / "tasks.json")
    tasks = data["tasks"]
    ids = [t["id"] for t in tasks]
    idset = set(ids)
    require(len(ids) == len(idset), "Duplicate task IDs in live tracker")
    require(data.get("package_status") == "active_tracker", "Live tracker must be active_tracker")
    tracker = data.get("tracker") or {}
    require(tracker.get("mode") == "json_in_repo", "DOC-03 must select json_in_repo")
    require(tracker.get("activated_by") == "DOC-03", "tracker.activated_by must be DOC-03")
    require(
        (tracker.get("issues_import") or {}).get("status") == "not_started",
        "GitHub Issues import must remain not_started without github_settings permission",
    )
    require((baseline / "MANIFEST.json").is_file(), "Missing import-baseline/MANIFEST.json")
    require((baseline / "tasks.json").is_file(), "Missing frozen import-baseline/tasks.json")
    checks.append("Live tracker mode/metadata and frozen import-baseline present")

    allowed_exec = {"not_started", "in_progress", "blocked", "done", "cancelled"}
    graph = {}
    for t in tasks:
        require(t.get("execution_state") in allowed_exec, f"{t['id']}: invalid execution_state")
        require(re.fullmatch(r"(DOC|OPS|FLOW|UX|GROW)-\d{2}", t["id"]) is not None, f"bad id {t['id']}")
        for d in t.get("dependencies", []):
            require(d in idset and d != t["id"], f"{t['id']}: invalid dependency {d}")
        graph[t["id"]] = t.get("dependencies", [])

    visited: set[str] = set()
    active: set[str] = set()

    def visit(tid: str) -> None:
        if tid in active:
            problems.append("Dependency cycle at " + tid)
            return
        if tid in visited:
            return
        active.add(tid)
        for d in graph.get(tid, []):
            if d in graph:
                visit(d)
        active.remove(tid)
        visited.add(tid)

    for tid in ids:
        visit(tid)
    checks.append("Unique IDs, allowed execution_state values, dependency DAG")

    frozen = load(baseline / "tasks.json")
    frozen_ids = [t["id"] for t in frozen["tasks"]]
    require(frozen_ids == ids, "Live task ID set/order diverged from import-baseline")
    require(frozen["package_status"] == "review_draft", "import-baseline must remain review_draft")
    require(
        all(t["execution_state"] == "not_started" for t in frozen["tasks"]),
        "import-baseline must keep execution_state=not_started",
    )
    manifest = load(baseline / "MANIFEST.json")
    for name, meta in manifest["files"].items():
        raw = (baseline / name).read_bytes()
        require(len(raw) == meta["bytes"], f"baseline size drift {name}")
        require(hashlib.sha256(raw).hexdigest() == meta["sha256"], f"baseline hash drift {name}")
    checks.append("Import-baseline frozen: ID set, review_draft, hashes")

    # Spec fields for unfinished tasks should still match baseline except DOC-03 decision fields.
    frozen_by = {t["id"]: t for t in frozen["tasks"]}
    mutable_when_done = {
        "execution_state",
        "execution_notes",
        "execution_updated_on",
        "current",
        "decision_status",
        "queue_state",
    }
    for t in tasks:
        base = frozen_by[t["id"]]
        for key, value in base.items():
            if key in mutable_when_done:
                continue
            if t.get(key) != value:
                problems.append(f"{t['id']}: specification field drifted from import-baseline: {key}")
    checks.append("Specification fields preserved vs import-baseline (status fields excluded)")

    done = [t["id"] for t in tasks if t["execution_state"] == "done"]
    for required in ("DOC-01", "DOC-02", "DOC-03"):
        require(required in done, f"{required} must be marked done after tracker activation")
    doc03 = next(t for t in tasks if t["id"] == "DOC-03")
    require(doc03["decision_status"] == "accepted_direction", "DOC-03 decision_status")
    require(doc03["queue_state"] == "specified", "DOC-03 queue_state after choice")
    checks.append("DOC-01/DOC-02/DOC-03 marked done; DOC-03 decision accepted")

    source = load(plan / "source-register.json")
    baseids = {s["id"] for s in source["sources"]}
    require(len(baseids) == 96, "Expected 96 unique original source IDs")
    covered: dict[str, list[str]] = collections.defaultdict(list)
    for t in tasks:
        for s in t["source_ids"]:
            covered[s].append(t["id"])
    for s in source["sources"]:
        require(s["id"] in covered, "Missing source coverage " + s["id"])
        require(set(s["task_ids"]) == set(covered[s["id"]]), "Stale source map " + s["id"])
    for n in range(1, 11):
        require(f"F{n:02}" in covered, f"Missing F{n:02}")
    checks.append("Source-register coverage and F01–F10 retained")

    report = {
        "status": "PASS" if not problems else "FAIL",
        "tracker_mode": tracker.get("mode"),
        "tasks": len(tasks),
        "done": done,
        "checks": checks,
        "problems": problems,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
