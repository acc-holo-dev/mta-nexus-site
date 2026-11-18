"""Inventory hard-coded guest strings on high-traffic public guest surfaces.

Read-only over git-tracked sources at a revision (CI-portable). Writes a
JSON snapshot with --output; --check fails on drift (source_sha ignored).

Sibling of inventory_shell_home_i18n.py for discover / public servers /
articles free-beta guest path. Excludes feature server/ ports, *-server
modules, tests, and workspace-only server management UI.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SCAN_PATHS = (
    "site/src/app/discover",
    "site/src/app/servers",
    "site/src/app/articles",
    "site/src/features/discovery",
    # Public directory / listing cards only — not workspace claim/manage forms.
    "site/src/features/servers/components/mta-master-server-directory.tsx",
    "site/src/features/servers/components/server-card.tsx",
    "site/src/features/servers/components/server-connect-controls.tsx",
    "site/src/features/servers/components/server-follow-button.tsx",
)

# locale === "ru"|"en" ? "<user copy>" : "<user copy>"
LOCALE_COPY_TERNARY = re.compile(
    r"""locale\s*===\s*["'](?:ru|en)["']\s*\?\s*["']([^"']{2,})["']\s*:\s*["']([^"']{2,})["']""",
    re.MULTILINE,
)

# BCP-47 / locale codes used for formatting — not guest copy.
LOCALE_TAG = re.compile(r"^(?:[a-z]{2}(?:-[A-Z]{2})?|[a-z]{2})$")

ARIA_LITERAL = re.compile(r"""aria-label\s*=\s*["']([^"']+)["']""")
TITLE_LITERAL = re.compile(r"""\btitle\s*=\s*["']([^"']+)["']""")
PLACEHOLDER_LITERAL = re.compile(r"""\bplaceholder\s*=\s*["']([^"']+)["']""")
ALT_LITERAL = re.compile(r"""\balt\s*=\s*["']([^"']+)["']""")

# JSX text on one line: >copy< or >copy{expr}
JSX_TEXT = re.compile(
    r""">\s*([A-Za-zА-Яа-яЁё©][^<{]{0,80}?)\s*(?:\{|<)""",
)

# Multiline JSX children: >\n  copy\n</tag>
JSX_TEXT_MULTILINE = re.compile(
    r""">\s*\n\s*([A-Za-zА-Яа-яЁё©][^\n<{]{0,80}?)\s*\n\s*<""",
)

# Split brand words glued with {" "}: MTA{" "}
JSX_TEXT_SPACE_GLUE = re.compile(
    r"""([A-Za-zА-Яа-яЁё]{2,})\{\s*["']\s*["']\s*\}""",
)

# Metadata template strings
TEMPLATE_LITERAL = re.compile(r"""template\s*:\s*["']([^"']+)["']""")

# Unknown/empty display marker kept as a literal (not locale-keyed).
UNKNOWN_MARKER = re.compile(r"""["']—["']""")

ALLOWLIST: tuple[dict[str, str], ...] = (
    {
        "id": "servers.detail.unknown-player-dash",
        "path": "site/src/app/servers/[slug]/page.tsx",
        "kind": "unknown-marker",
        "text": "—",
    },
    {
        "id": "servers.card.unknown-occupancy-dash",
        "path": "site/src/features/servers/components/server-card.tsx",
        "kind": "unknown-marker",
        "text": "—",
    },
)


def _git_show(revision: str, path: str) -> str:
    return subprocess.check_output(
        ["git", "show", f"{revision}:{path}"],
        cwd=ROOT,
        text=True,
    )


def _read_source(revision: str, path: str) -> str:
    """Prefer the working tree when inventorying the current checkout.

    CI checkouts are clean (working tree == HEAD). Local regenerate/--check
    before commit must see uncommitted copy moves into dictionaries.
    """
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    target = subprocess.check_output(["git", "rev-parse", revision], cwd=ROOT, text=True).strip()
    if target == head:
        file_path = ROOT / path
        if file_path.is_file():
            return file_path.read_text(encoding="utf8")
    return _git_show(revision, path)


def _ls_paths(revision: str) -> list[str]:
    paths: list[str] = []
    for prefix in SCAN_PATHS:
        raw = subprocess.check_output(
            ["git", "ls-tree", "-r", "--name-only", revision, "--", prefix],
            cwd=ROOT,
            text=True,
        )
        for path in raw.splitlines():
            path = path.replace("\\", "/")
            if path.endswith((".test.ts", ".test.tsx", ".md")):
                continue
            # Server-only feature ports/loaders are not guest UI copy surfaces.
            if re.search(r"/features/[^/]+/server/", f"/{path}"):
                continue
            if path.endswith(("-server.ts", "-server.tsx")):
                continue
            if path.endswith((".ts", ".tsx")):
                paths.append(path)
    return sorted(set(paths))


def _is_noise_text(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True
    if LOCALE_TAG.fullmatch(stripped):
        return True
    # Technical tokens / single glyphs already covered; keep brand dashes.
    if stripped in {"·", "|", "/", "#", "..."}:
        return True
    # JSX_TEXT can false-match TS arrow bodies (`> ident.method(`).
    if "(" in stripped or ")" in stripped or ".charCodeAt" in stripped:
        return True
    return False


def _findings_in_source(path: str, source: str) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []
    lines = source.splitlines()

    for match in LOCALE_COPY_TERNARY.finditer(source):
        left, right = match.group(1), match.group(2)
        if LOCALE_TAG.fullmatch(left) and LOCALE_TAG.fullmatch(right):
            continue
        line = source[: match.start()].count("\n") + 1
        findings.append(
            {
                "path": path,
                "line": line,
                "kind": "locale-copy-ternary",
                "text": match.group(0).strip()[:120],
            }
        )

    for index, line in enumerate(lines, start=1):
        for kind, pattern in (
            ("aria-label", ARIA_LITERAL),
            ("title", TITLE_LITERAL),
            ("placeholder", PLACEHOLDER_LITERAL),
            ("alt", ALT_LITERAL),
            ("template", TEMPLATE_LITERAL),
        ):
            for match in pattern.finditer(line):
                text = match.group(1).strip()
                if _is_noise_text(text):
                    continue
                findings.append({"path": path, "line": index, "kind": kind, "text": text})

        for match in JSX_TEXT.finditer(line):
            text = match.group(1).strip()
            if _is_noise_text(text):
                continue
            if text.startswith("{") or "dictionary." in text:
                continue
            findings.append({"path": path, "line": index, "kind": "jsx-text", "text": text})

        for match in JSX_TEXT_SPACE_GLUE.finditer(line):
            text = match.group(1).strip()
            if _is_noise_text(text):
                continue
            findings.append({"path": path, "line": index, "kind": "jsx-text", "text": text})

        if UNKNOWN_MARKER.search(line):
            findings.append({"path": path, "line": index, "kind": "unknown-marker", "text": "—"})

    for match in JSX_TEXT_MULTILINE.finditer(source):
        text = match.group(1).strip()
        if _is_noise_text(text):
            continue
        line = source[: match.start()].count("\n") + 1
        # Point at the text line (usually the next line after `>`).
        line = source[: match.start(1)].count("\n") + 1
        findings.append({"path": path, "line": line, "kind": "jsx-text", "text": text})

    return findings


def _allowlist_key(item: dict[str, object]) -> tuple[str, str, str]:
    return (str(item["path"]), str(item["kind"]), str(item["text"]))


def inventory(revision: str = "HEAD") -> dict[str, object]:
    sha = subprocess.check_output(["git", "rev-parse", revision], cwd=ROOT, text=True).strip()
    paths = _ls_paths(revision)
    findings: list[dict[str, object]] = []
    for path in paths:
        findings.extend(_findings_in_source(path, _read_source(revision, path)))

    # Deduplicate identical path/line/kind/text hits from overlapping scanners.
    unique: dict[tuple[object, ...], dict[str, object]] = {}
    for finding in findings:
        key = (finding["path"], finding["line"], finding["kind"], finding["text"])
        unique[key] = finding
    findings = list(unique.values())

    allow_keys = {_allowlist_key(entry) for entry in ALLOWLIST}
    allow_by_key = {_allowlist_key(entry): entry["id"] for entry in ALLOWLIST}

    annotated: list[dict[str, object]] = []
    for finding in findings:
        key = _allowlist_key(finding)
        row = dict(finding)
        if key in allow_keys:
            row["allowlist_id"] = allow_by_key[key]
        annotated.append(row)

    annotated.sort(key=lambda row: (str(row["path"]), int(row["line"]), str(row["kind"]), str(row["text"])))

    allowlisted = [row for row in annotated if "allowlist_id" in row]
    unallowlisted = [row for row in annotated if "allowlist_id" not in row]
    locale_ternaries = [row for row in annotated if row["kind"] == "locale-copy-ternary"]

    return {
        "source_sha": sha,
        "scope": (
            "Git-tracked public guest surfaces — discover, public servers directory/"
            "detail, articles, discovery feature (excluding server/ and *-server "
            "ports), and guest server directory components — hard-coded guest-facing "
            "literals + locale copy ternaries."
        ),
        "scan_roots": list(SCAN_PATHS),
        "allowlist": [dict(entry) for entry in ALLOWLIST],
        "summary": {
            "scanned_files": len(paths),
            "findings": len(annotated),
            "allowlisted": len(allowlisted),
            "unallowlisted": len(unallowlisted),
            "locale_copy_ternaries": len(locale_ternaries),
        },
        "findings": annotated,
    }


def _canonical(data: dict[str, object]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _biome_format(path: Path) -> None:
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


def _diff(expected: object, actual: object, path: str = "$") -> list[str]:
    lines: list[str] = []
    if type(expected) is not type(actual):
        return [f"{path}: type {type(expected).__name__} != {type(actual).__name__}"]
    if isinstance(expected, dict):
        assert isinstance(actual, dict)
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
            lines.append(f"{path}: list drift ({len(expected)} vs {len(actual)} entries)")
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
        help="Fail unless path matches freshly generated inventory (source_sha ignored)",
    )
    args = parser.parse_args()
    data = inventory(args.revision)
    text = _canonical(data)

    if data["summary"]["unallowlisted"]:  # type: ignore[index]
        extras = [
            f"{row['path']}:{row['line']} [{row['kind']}] {row['text']!r}"
            for row in data["findings"]  # type: ignore[union-attr]
            if "allowlist_id" not in row
        ]
        message = "Unallowlisted hard-coded strings in public-guest scope:\n" + "\n".join(
            extras[:40]
        )
        if args.check or args.output:
            # Still write output so operators can inspect, then fail check.
            if args.output:
                args.output.write_text(text, encoding="utf8")
                _biome_format(args.output)
            if args.check:
                raise SystemExit(message + "\nUpdate ALLOWLIST deliberately or move copy into i18n.")
            print(message, flush=True)
            return 1
        print(message, flush=True)

    if args.output:
        args.output.write_text(text, encoding="utf8")
        _biome_format(args.output)

    if args.check:
        expected = json.loads(args.check.read_text(encoding="utf8"))
        if _stable_payload(expected) != _stable_payload(data):
            details = "\n".join(_diff(_stable_payload(expected), _stable_payload(data))[:40])
            raise SystemExit(
                f"Public-guest i18n inventory drift vs {args.check}.\n{details}\n"
                "Regenerate with: python3 planning/tools/inventory_public_guest_i18n.py "
                f"--output {args.check}"
            )
        if expected.get("summary", {}).get("unallowlisted", 0) != 0:
            raise SystemExit("Committed snapshot must keep unallowlisted at 0.")

    if not args.output and not args.check:
        print(text, end="")
    else:
        print(
            json.dumps(
                {
                    "source_sha": data["source_sha"],
                    "summary": data["summary"],
                },
                ensure_ascii=False,
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
