#!/usr/bin/env python3
"""List open tracker cards from planning/tasks.json (execution_state != done)."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TASKS = ROOT / "planning" / "tasks.json"


def main() -> int:
    data = json.loads(TASKS.read_text(encoding="utf8"))
    tasks = data["tasks"]
    counts = Counter(task.get("execution_state") for task in tasks)
    print(
        f"baseline={data.get('baseline_sha')} as_of={data.get('as_of')} "
        f"done={counts.get('done', 0)} not_started={counts.get('not_started', 0)} "
        f"other={sum(v for k, v in counts.items() if k not in {'done', 'not_started'})}"
    )
    open_tasks = [task for task in tasks if task.get("execution_state") != "done"]
    for task in open_tasks:
        print(
            f"{task['id']}\t{task.get('execution_state')}\t{task.get('queue_state')}\t"
            f"{task.get('permission')}\t{task['title']}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
