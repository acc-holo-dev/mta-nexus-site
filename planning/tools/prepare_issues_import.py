"""Dry-run readiness check for a future one-shot GitHub Issues import.

Does not create Issues, change repository visibility, or call the GitHub API.
Requires a separate owner permission with github_settings before any live import.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "planning"
BASELINE = PLAN / "import-baseline"


def main() -> int:
    manifest = json.loads((BASELINE / "MANIFEST.json").read_text(encoding="utf8"))
    live = json.loads((PLAN / "tasks.json").read_text(encoding="utf8"))
    frozen = json.loads((BASELINE / "tasks.json").read_text(encoding="utf8"))
    problems: list[str] = []

    if live.get("tracker", {}).get("mode") != "json_in_repo":
        problems.append("Live tracker mode is not json_in_repo")
    if live.get("tracker", {}).get("issues_import", {}).get("status") != "not_started":
        problems.append("issues_import.status must stay not_started until an authorized import runs")

    for name, meta in manifest["files"].items():
        raw = (BASELINE / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != meta["sha256"]:
            problems.append(f"import-baseline hash drift: {name}")

    live_ids = [t["id"] for t in live["tasks"]]
    frozen_ids = [t["id"] for t in frozen["tasks"]]
    if live_ids != frozen_ids:
        problems.append("Live task IDs diverged from import-baseline; freeze a new baseline before Issues import")

    # Proposed Issue payload keys for a future importer (not executed).
    sample = []
    for t in frozen["tasks"][:3]:
        sample.append(
            {
                "title": f"{t['id']}: {t['title']}",
                "labels": [t["track"], t["phase"], t["priority"], t["permission"]],
                "body_fields": {
                    "task_id": t["id"],
                    "source_ids": t["source_ids"],
                    "decision_refs": t["decision_refs"],
                    "dependencies": t["dependencies"],
                    "acceptance": t["acceptance"],
                    "baseline_sha": frozen["baseline_sha"],
                },
            }
        )

    report = {
        "status": "READY_FOR_AUTHORIZED_IMPORT" if not problems else "BLOCKED",
        "permission_required": "github_settings",
        "creates_issues": False,
        "import_baseline": str(BASELINE.relative_to(ROOT)),
        "task_count": len(frozen_ids),
        "idempotency_rule": "Import key is task id; re-import must update existing Issue by task id, never duplicate",
        "after_import": [
            "Set planning/tasks.json tracker.issues_import.status=completed only after verified import",
            "Treat import-baseline JSON as frozen source of truth for the import snapshot",
            "Track execution only in GitHub Issues; ROADMAP holds links; do not maintain a second manual status board",
        ],
        "sample_issue_mapping": sample,
        "problems": problems,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
