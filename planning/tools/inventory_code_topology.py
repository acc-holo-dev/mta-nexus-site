"""Inventory AS-IS code topology counts for docs/current/code-topology.md.

Read-only: counts **git-tracked** paths under site/ at a revision (CI-portable).
Write JSON with --output; verify a committed snapshot with --check.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _ls_tree(revision: str, prefix: str) -> list[tuple[str, int]]:
    """Return (posix-path, byte-size) for blobs under prefix at revision."""
    raw = subprocess.check_output(
        ["git", "ls-tree", "-r", "-l", revision, "--", prefix],
        cwd=ROOT,
        text=True,
    )
    entries: list[tuple[str, int]] = []
    for line in raw.splitlines():
        # <mode> <type> <object> <size>\t<path>
        meta, _, path = line.partition("\t")
        if not path:
            continue
        parts = meta.split()
        if len(parts) < 4 or parts[1] != "blob":
            continue
        size_token = parts[3]
        if size_token == "-":
            continue
        entries.append((path.replace("\\", "/"), int(size_token)))
    return entries


def _under(entries: list[tuple[str, int]], prefix: str) -> list[tuple[str, int]]:
    prefix = prefix.rstrip("/") + "/"
    return [(path, size) for path, size in entries if path.startswith(prefix)]


def _root_files(entries: list[tuple[str, int]], directory: str) -> list[tuple[str, int]]:
    directory = directory.rstrip("/")
    out: list[tuple[str, int]] = []
    for path, size in entries:
        parent = path.rsplit("/", 1)[0]
        if parent == directory:
            out.append((path, size))
    return out


def _root_dirs(entries: list[tuple[str, int]], directory: str) -> list[str]:
    directory = directory.rstrip("/") + "/"
    names: set[str] = set()
    for path, _ in entries:
        if not path.startswith(directory):
            continue
        rest = path[len(directory) :]
        if "/" in rest:
            names.add(rest.split("/", 1)[0])
    return sorted(names)


def _basename(path: str) -> str:
    return path.rsplit("/", 1)[-1]


def _prefix_hotspots(files: list[tuple[str, int]], limit: int = 12) -> list[dict[str, int | str]]:
    counts: Counter[str] = Counter()
    for path, _ in files:
        name = _basename(path)
        stem = name.split("-", 1)[0] if "-" in name else Path(name).stem
        counts[stem] += 1
    # Deterministic ties: higher count first, then prefix name (CI vs host walk order must not drift).
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:limit]
    return [{"prefix": name, "files": count} for name, count in ranked]


def _shellish_components(files: list[tuple[str, int]]) -> list[str]:
    needles = ("nav", "footer", "shell", "header", "sidebar", "auth", "locale")
    return sorted(
        _basename(path)
        for path, _ in files
        if any(needle in _basename(path).lower() for needle in needles)
    )


def _husk_status(revision: str) -> dict[str, object]:
    tracked = subprocess.check_output(
        ["git", "ls-tree", "-r", "--name-only", revision, "--", "packages", "apps/web"],
        cwd=ROOT,
        text=True,
    ).strip()
    workspace = subprocess.check_output(
        ["git", "show", f"{revision}:pnpm-workspace.yaml"],
        cwd=ROOT,
        text=True,
    )
    members = []
    if "- \"site\"" in workspace or "- 'site'" in workspace:
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
    site = _ls_tree(revision, "site")

    features: dict[str, dict[str, int]] = {}
    for name in _root_dirs(site, "site/src/features"):
        paths = _under(site, f"site/src/features/{name}")
        features[name] = {
            "files": len(paths),
            "bytes": sum(size for _, size in paths),
        }

    components_tree = _under(site, "site/src/components")
    components_root = _root_files(site, "site/src/components")
    lib_tree = _under(site, "site/src/lib")
    lib_root = _root_files(site, "site/src/lib")
    services_root = _root_files(site, "site/src/lib/services")
    i18n = [(path, size) for path, size in lib_tree if path.endswith("-i18n.ts")]
    routes = [
        (path, size)
        for path, size in _under(site, "site/src/app")
        if _basename(path) == "route.ts"
    ]

    packages: dict[str, int] = {}
    for name in _root_dirs(site, "site/packages"):
        packages[name] = len(_under(site, f"site/packages/{name}/src"))

    tests = _under(site, "site/tests")

    return {
        "source_sha": sha,
        "scope": (
            "Git-tracked blobs under site/ at source_sha (git ls-tree). "
            "Ignores untracked/ignored host files so CI and dirty worktrees match."
        ),
        "features": features,
        "components": {
            "tree_files": len(components_tree),
            "tree_bytes": sum(size for _, size in components_tree),
            "root_files": len(components_root),
            "shellish_root_files": _shellish_components(components_root),
        },
        "lib": {
            "tree_files": len(lib_tree),
            "tree_bytes": sum(size for _, size in lib_tree),
            "root_files": len(lib_root),
            "root_dirs": _root_dirs(site, "site/src/lib"),
            "services_root_files": len(services_root),
            "i18n_modules": len(i18n),
            "root_prefix_hotspots": _prefix_hotspots(lib_root),
        },
        "app": {"route_ts": len(routes)},
        "packages_src_files": packages,
        "tests": {"site_tests_files": len(tests)},
        "husks": _husk_status(sha),
    }


def _canonical(data: dict[str, object]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _biome_format(path: Path) -> None:
    """Match repo format:check when the Biome CLI is available."""
    biome = ROOT / "node_modules" / "@biomejs" / "biome" / "bin" / "biome"
    if not biome.is_file():
        return
    subprocess.run(
        ["node", str(biome), "format", "--write", str(path)],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )


def _stable_payload(data: dict[str, object]) -> dict[str, object]:
    payload = dict(data)
    payload.pop("source_sha", None)
    return payload


def _diff(expected: dict[str, object], actual: dict[str, object], path: str = "$") -> list[str]:
    lines: list[str] = []
    if type(expected) is not type(actual):
        return [f"{path}: type {type(expected).__name__} != {type(actual).__name__}"]
    if isinstance(expected, dict):
        for key in sorted(set(expected) | set(actual)):
            child = f"{path}.{key}"
            if key not in expected:
                lines.append(f"{child}: missing in snapshot")
            elif key not in actual:
                lines.append(f"{child}: missing in live inventory")
            else:
                lines.extend(_diff(expected[key], actual[key], child))
    elif isinstance(expected, list):
        if expected != actual:
            lines.append(f"{path}: {expected!r} != {actual!r}")
    elif expected != actual:
        lines.append(f"{path}: {expected!r} != {actual!r}")
    return lines


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
        _biome_format(args.output)
    if args.check:
        expected = json.loads(args.check.read_text(encoding="utf8"))
        if _stable_payload(expected) != _stable_payload(data):
            details = "\n".join(_diff(_stable_payload(expected), _stable_payload(data))[:40])
            raise SystemExit(
                f"Topology inventory drift vs {args.check}.\n{details}\n"
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
