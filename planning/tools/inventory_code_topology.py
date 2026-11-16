"""Inventory AS-IS code topology counts for docs/current/code-topology.md.

Read-only: walks site/src and site/packages, never edits application code.
Write JSON with --output; verify a committed snapshot with --check.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE_SRC = ROOT / "site" / "src"
SITE_PACKAGES = ROOT / "site" / "packages"


def _files(path: Path) -> list[Path]:
    if not path.exists():
        return []
    return [
        entry
        for entry in path.rglob("*")
        if entry.is_file() and "node_modules" not in entry.parts and ".git" not in entry.parts
    ]


def _bytes(paths: list[Path]) -> int:
    return sum(entry.stat().st_size for entry in paths)


def _root_files(path: Path) -> list[Path]:
    if not path.exists():
        return []
    return [entry for entry in path.iterdir() if entry.is_file()]


def _root_dirs(path: Path) -> list[str]:
    if not path.exists():
        return []
    return sorted(entry.name for entry in path.iterdir() if entry.is_dir())


def _prefix_hotspots(files: list[Path], limit: int = 12) -> list[dict[str, int | str]]:
    counts: Counter[str] = Counter()
    for entry in files:
        stem = entry.name.split("-", 1)[0] if "-" in entry.name else entry.stem
        counts[stem] += 1
    return [{"prefix": name, "files": count} for name, count in counts.most_common(limit)]


def _shellish_components(files: list[Path]) -> list[str]:
    needles = ("nav", "footer", "shell", "header", "sidebar", "auth", "locale")
    names = sorted(
        entry.name
        for entry in files
        if any(needle in entry.name.lower() for needle in needles)
    )
    return names


def _husk_status() -> dict[str, object]:
    """Git/workspace facts only — host-local leftover dirs are not portable across CI."""
    tracked = subprocess.check_output(
        ["git", "ls-files", "packages", "apps/web"],
        cwd=ROOT,
        text=True,
    ).strip()
    workspace = (ROOT / "pnpm-workspace.yaml").read_text(encoding="utf8")
    members = []
    if '"site"' in workspace or "- \"site\"" in workspace or "- 'site'" in workspace:
        members.append("site")
    if "site/packages/*" in workspace:
        members.append("site/packages/*")
    return {
        "git_tracked_paths": tracked.splitlines() if tracked else [],
        "workspace_members": members,
        "legacy_root_paths_not_in_workspace": [
            "packages/config",
            "packages/db",
            "packages/domain",
            "packages/security",
            "packages/storage",
            "packages/ui",
            "packages/validation",
            "apps/web",
        ],
        "note": (
            "Canonical packages live under site/packages/*. Root packages/* and apps/web "
            "are not workspace members and must stay untracked; host leftovers vary by machine."
        ),
    }


def inventory(revision: str = "HEAD") -> dict[str, object]:
    sha = subprocess.check_output(["git", "rev-parse", revision], cwd=ROOT, text=True).strip()
    features: dict[str, dict[str, int]] = {}
    for name in _root_dirs(SITE_SRC / "features"):
        paths = _files(SITE_SRC / "features" / name)
        features[name] = {"files": len(paths), "bytes": _bytes(paths)}

    components_tree = _files(SITE_SRC / "components")
    components_root = _root_files(SITE_SRC / "components")
    lib_tree = _files(SITE_SRC / "lib")
    lib_root = _root_files(SITE_SRC / "lib")
    services_root = _root_files(SITE_SRC / "lib" / "services")
    i18n = list((SITE_SRC / "lib").rglob("*-i18n.ts")) if (SITE_SRC / "lib").exists() else []
    routes = list((SITE_SRC / "app").rglob("route.ts")) if (SITE_SRC / "app").exists() else []

    packages: dict[str, int] = {}
    for name in _root_dirs(SITE_PACKAGES):
        packages[name] = len(_files(SITE_PACKAGES / name / "src"))

    return {
        "source_sha": sha,
        "scope": (
            "Tracked working tree counts under site/src and site/packages; "
            "excludes node_modules. Local root packages/ and apps/web husks are reported separately."
        ),
        "features": features,
        "components": {
            "tree_files": len(components_tree),
            "tree_bytes": _bytes(components_tree),
            "root_files": len(components_root),
            "shellish_root_files": _shellish_components(components_root),
        },
        "lib": {
            "tree_files": len(lib_tree),
            "tree_bytes": _bytes(lib_tree),
            "root_files": len(lib_root),
            "root_dirs": _root_dirs(SITE_SRC / "lib"),
            "services_root_files": len([path for path in services_root if path.is_file()]),
            "i18n_modules": len(i18n),
            "root_prefix_hotspots": _prefix_hotspots(lib_root),
        },
        "app": {"route_ts": len(routes)},
        "packages_src_files": packages,
        "tests": {"site_tests_files": len(_files(ROOT / "site" / "tests"))},
        "husks": _husk_status(),
    }


def _canonical(data: dict[str, object]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _stable_payload(data: dict[str, object]) -> dict[str, object]:
    """Counts and structure only — source_sha tracks the measuring commit and may lag HEAD."""
    payload = dict(data)
    payload.pop("source_sha", None)
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", default="HEAD")
    parser.add_argument("--output", type=Path, help="Write JSON inventory")
    parser.add_argument(
        "--check",
        type=Path,
        help="Fail unless path matches freshly generated inventory counts (source_sha ignored)",
    )
    args = parser.parse_args()
    data = inventory(args.revision)
    text = _canonical(data)
    if args.output:
        args.output.write_text(text, encoding="utf8")
    if args.check:
        expected = json.loads(args.check.read_text(encoding="utf8"))
        if _stable_payload(expected) != _stable_payload(data):
            raise SystemExit(
                f"Topology inventory drift vs {args.check}. "
                "Regenerate with: python3 planning/tools/inventory_code_topology.py "
                f"--output {args.check}"
            )
    if not args.output and not args.check:
        print(text, end="")
    else:
        print(
            json.dumps(
                {
                    "source_sha": data["source_sha"],
                    "features": len(data["features"]),  # type: ignore[arg-type]
                    "lib_root_files": data["lib"]["root_files"],  # type: ignore[index]
                    "components_root_files": data["components"]["root_files"],  # type: ignore[index]
                },
                ensure_ascii=False,
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
