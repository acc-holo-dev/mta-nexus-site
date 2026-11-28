"""Validate the active JSON-in-repo working tracker (DOC-03)."""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import subprocess
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "planning"
BASELINE = PLAN / "import-baseline"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf8"))


def tracker_tasks(data):
    """Flatten current layers; legacy root tasks are supported only for Git evidence."""
    if "layers" in data:
        return [task for name in ("live", "history") for task in data["layers"][name]["tasks"]]
    return data["tasks"]


def validate_contract(data, schema) -> list[str]:
    """Validate structure before traversing task IDs or dependency edges."""
    Draft202012Validator.check_schema(schema)
    errors = sorted(
        Draft202012Validator(schema).iter_errors(data),
        key=lambda error: str(list(error.absolute_path)),
    )
    if errors:
        return [f"schema {list(error.absolute_path)}: {error.message}" for error in errors]
    tasks = tracker_tasks(data)
    ids = [task["id"] for task in tasks]
    problems = []
    if not tasks:
        problems.append("Tracker must contain tasks")
    for name, layer in data["layers"].items():
        if layer["count"] != len(layer["tasks"]):
            problems.append(f"{name}: layer count mismatch")
    if any(task["execution_state"] != "done" for task in data["layers"]["history"]["tasks"]):
        problems.append("History layer must retain completed tasks")
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


AUD_ID = re.compile(r"^AUD-[0-9]{2}$")
MUTABLE_STATUS_FIELDS = {
    "execution_state", "execution_notes", "execution_updated_on",
    "current", "decision_status", "queue_state",
}


def validate_extensions(data, frozen, admitted, source) -> list[str]:
    """AUD cards are an additive admission. Frozen IDs and the original 96 sources stay put."""
    if not isinstance(admitted, dict):
        return ["Missing planning/admitted-tasks.json"]
    problems = []
    if admitted.get("schema_version") != 1:
        problems.append("admitted-tasks schema_version must be 1")
    if admitted.get("baseline_sha") != frozen.get("baseline_sha"):
        problems.append("admitted-tasks baseline_sha drifted from the frozen import")
    audit_sha = admitted.get("audit_sha")
    if not isinstance(audit_sha, str) or re.fullmatch(r"[a-f0-9]{40}", audit_sha) is None:
        problems.append("admitted-tasks audit_sha must be the audited commit")
    admitted_tasks = admitted.get("tasks")
    if not isinstance(admitted_tasks, list):
        return problems + ["admitted-tasks.tasks must be a list"]
    admitted_ids = [task.get("id") for task in admitted_tasks]
    if (
        len(admitted_ids) != len(set(admitted_ids))
        or any(not isinstance(task_id, str) or AUD_ID.fullmatch(task_id) is None for task_id in admitted_ids)
    ):
        problems.append("admitted task IDs must be unique AUD-NN values")
    live_ids = [task["id"] for task in tracker_tasks(data)]
    frozen_ids = [task["id"] for task in frozen["tasks"]]
    if set(frozen_ids) - set(live_ids):
        problems.append("Frozen task ID removed from live tracker")
    if set(live_ids) - set(frozen_ids) != set(admitted_ids):
        problems.append("Live task IDs diverged from frozen baseline plus admitted extensions")
    history_ids = {task["id"] for task in data["layers"]["history"]["tasks"]}
    if history_ids & set(admitted_ids):
        problems.append("Admitted audit tasks must stay in the live layer")
    covered = collections.defaultdict(list)
    for task in tracker_tasks(data):
        for source_id in task["source_ids"]:
            covered[source_id].append(task["id"])
    additional = set(source.get("additional_source_ids") or [])
    live_by_id = {task["id"]: task for task in tracker_tasks(data)}
    for task_id in admitted_ids:
        if task_id not in additional:
            problems.append("Missing additional source coverage " + task_id)
        elif covered[task_id] != [task_id]:
            problems.append("Stale audit source map " + task_id)
        elif live_by_id[task_id]["source_ids"] != [task_id]:
            problems.append(task_id + " source_ids must be exactly its own ID")
    return problems


def validate_specifications(data, frozen, evidence, load_commit, admitted_tasks=None) -> list[str]:
    digest_schema = {"type": "string", "pattern": "^[a-f0-9]{64}$"}
    entry_properties = {
        "id": {"type": "string", "pattern": "^(DOC|OPS|FLOW|UX|GROW|AUD)-[0-9]{2}$"},
        "field": {"enum": sorted(set(frozen["tasks"][0]) - MUTABLE_STATUS_FIELDS - {"id"})},
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
    frozen_by = {task["id"]: task for task in frozen["tasks"]}
    admitted_by = {task["id"]: task for task in (admitted_tasks or [])}
    for task in tracker_tasks(data):
        base = frozen_by.get(task["id"])
        if base is None:
            base = admitted_by.get(task["id"])
        if base is None:
            problems.append("Task missing from frozen baseline and admitted extensions: " + task["id"])
            continue
        for field, value in base.items():
            if field in MUTABLE_STATUS_FIELDS or task.get(field) == value:
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
                    commits[commit] = {t["id"]: t for t in tracker_tasks(load_commit(commit))}
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
    tasks = tracker_tasks(data)
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
    try:
        admitted = load(plan / "admitted-tasks.json")
    except (OSError, ValueError) as error:
        admitted = None
        problems.append(f"admitted-tasks.json: {error}")
    source = load(plan / "source-register.json")
    problems.extend(validate_extensions(data, frozen, admitted, source))
    checks.append("Frozen IDs retained; AUD cards match admitted-tasks.json and source coverage")
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
        None if admitted is None else admitted.get("tasks"),
    ))
    checks.append("Specification fields match frozen baseline, admitted audit cards, or exact Git-evidenced amendments")

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
