"""Validate the active JSON-in-repo working tracker (DOC-03)."""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import subprocess
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "planning"
BASELINE = PLAN / "import-baseline"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf8"))


def validate_contract(data, schema) -> list[str]:
    """Validate structure before traversing task IDs or dependency edges."""
    Draft202012Validator.check_schema(schema)
    errors = sorted(
        Draft202012Validator(schema).iter_errors(data),
        key=lambda error: str(list(error.absolute_path)),
    )
    if errors:
        return [f"schema {list(error.absolute_path)}: {error.message}" for error in errors]
    tasks = data["tasks"]
    ids = [task["id"] for task in tasks]
    problems = []
    if len(ids) != len(set(ids)):
        problems.append("Duplicate task IDs in live tracker")
    graph = {task["id"]: task["dependencies"] for task in tasks}
    for task in tasks:
        edges = task["dependencies"] + [edge["id"] for edge in task.get("conditional_dependencies", [])]
        graph[task["id"]] = edges
        for dependency in edges:
            if dependency not in graph or dependency == task["id"]:
                problems.append(f"{task['id']}: invalid dependency {dependency}")
    visited, active = set(), set()

    def visit(task_id):
        if task_id in active:
            problems.append("Dependency cycle at " + task_id)
            return
        if task_id in visited:
            return
        active.add(task_id)
        for dependency in graph.get(task_id, []):
            if dependency in graph:
                visit(dependency)
        active.remove(task_id)
        visited.add(task_id)

    for task_id in ids:
        visit(task_id)
    return problems


def value_digest(value) -> str:
    canonical = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf8")).hexdigest()


def load_commit_tasks(repo: Path, commit: str):
    """Evidence must belong to this checkout's committed history."""
    subprocess.run(["git", "merge-base", "--is-ancestor", commit, "HEAD"],
                   cwd=repo, check=True, capture_output=True)
    raw = subprocess.check_output(["git", "show", commit + ":planning/tasks.json"], cwd=repo, stderr=subprocess.PIPE)
    return json.loads(raw)


def validate_specifications(data, frozen, evidence, load_commit) -> list[str]:
    digest_schema = {"type": "string", "pattern": "^[a-f0-9]{64}$"}
    entry_properties = {
        "id": {"type": "string", "pattern": "^(DOC|OPS|FLOW|UX|GROW)-[0-9]{2}$"},
        "field": {"enum": ["verification", "scope_files"]},
        "baseline_sha256": digest_schema,
        "value_sha256": digest_schema,
        "commit": {"type": "string", "pattern": "^[a-f0-9]{40}$"},
        "reason": {"type": "string", "minLength": 1},
    }
    schema = {
        "type": "object", "additionalProperties": False,
        "required": ["schema_version", "baseline_sha", "amendments"],
        "properties": {
            "schema_version": {"const": 1},
            "baseline_sha": {"const": frozen["baseline_sha"]},
            "amendments": {"type": "array", "items": {
                "type": "object", "additionalProperties": False,
                "required": list(entry_properties), "properties": entry_properties,
            }},
        },
    }
    errors = list(Draft202012Validator(schema).iter_errors(evidence))
    if errors:
        return ["Amendment schema: " + error.message for error in errors]
    problems, amendments, used, commits = [], {}, set(), {}
    for entry in evidence["amendments"]:
        key = (entry["id"], entry["field"])
        if key in amendments:
            problems.append(f"Duplicate amendment: {key}")
        amendments[key] = entry
    mutable_status_fields = {
        "execution_state", "execution_notes", "execution_updated_on",
        "current", "decision_status", "queue_state",
    }
    frozen_by = {task["id"]: task for task in frozen["tasks"]}
    for task in data["tasks"]:
        base = frozen_by.get(task["id"])
        if base is None:
            problems.append("Task missing from frozen baseline: " + task["id"])
            continue
        for field, value in base.items():
            if field in mutable_status_fields or task.get(field) == value:
                continue
            key = (task["id"], field)
            entry = amendments.get(key)
            if not entry:
                problems.append(f"{task['id']}: unrecorded specification drift: {field}")
                continue
            used.add(key)
            if (entry["baseline_sha256"] != value_digest(value)
                    or entry["value_sha256"] != value_digest(task.get(field))):
                problems.append(f"{task['id']}: amendment digest mismatch: {field}")
                continue
            commit = entry["commit"]
            if commit not in commits:
                try:
                    commits[commit] = {t["id"]: t for t in load_commit(commit)["tasks"]}
                except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError):
                    commits[commit] = {}
            if commits[commit].get(task["id"], {}).get(field) != task.get(field):
                problems.append(f"{task['id']}: amendment Git evidence mismatch: {field}")
    for key in amendments.keys() - used:
        problems.append(f"Unused or stale amendment: {key}")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", type=Path, default=ROOT)
    ap.add_argument("--contract-only", action="store_true",
                    help="Validate live schema and dependency graph, excluding historical audit")
    args = ap.parse_args()
    repo = args.repo.resolve()
    plan = repo / "planning"
    baseline = plan / "import-baseline"
    problems: list[str] = []
    checks: list[str] = []

    def require(cond: bool, msg: str) -> None:
        if not cond:
            problems.append(msg)

    try:
        data = load(plan / "tasks.json")
        problems.extend(validate_contract(data, load(plan / "task-schema.json")))
    except (OSError, ValueError) as error:
        problems.append(str(error))
    if problems or args.contract_only:
        print(json.dumps({"status": "FAIL" if problems else "PASS",
                          "scope": "live_contract", "problems": problems},
                         ensure_ascii=False, indent=2))
        return 1 if problems else 0
    checks.append("Draft 2020-12 JSON Schema and live dependency graph")
    tasks = data["tasks"]
    ids = [t["id"] for t in tasks]
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

    frozen = load(baseline / "tasks.json")
    frozen_ids = [t["id"] for t in frozen["tasks"]]
    require(frozen_ids == ids, "Live task ID set/order diverged from import-baseline")
    require(frozen["package_status"] == "review_draft", "import-baseline must remain review_draft")
    require(
        all(t["execution_state"] == "not_started" for t in frozen["tasks"]),
        "import-baseline must keep execution_state=not_started",
    )
    manifest = load(baseline / "MANIFEST.json")
    require(
        data["baseline_sha"] == frozen["baseline_sha"] == manifest["baseline_sha"],
        "Historical baseline_sha must agree across live tracker, frozen snapshot and manifest",
    )
    require(set(manifest["files"]) == {"tasks.json", "task-schema.json", "source-register.json"},
            "Frozen manifest must cover the three original artifacts")
    for name, meta in manifest["files"].items():
        raw = (baseline / name).read_bytes()
        require(len(raw) == meta["bytes"], f"baseline size drift {name}")
        require(hashlib.sha256(raw).hexdigest() == meta["sha256"], f"baseline hash drift {name}")
    checks.append("Import-baseline frozen: ID set, review_draft, hashes")

    problems.extend(validate_specifications(
        data, frozen, load(plan / "spec-amendments.json"),
        lambda commit: load_commit_tasks(repo, commit),
    ))
    checks.append("Specification fields match frozen baseline or exact Git-evidenced amendments")

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
        "execution_counts": dict(collections.Counter(t["execution_state"] for t in tasks)),
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
