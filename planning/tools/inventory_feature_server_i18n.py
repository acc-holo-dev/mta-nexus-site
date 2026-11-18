"""
Inventory hard-coded strings on feature server/ ports and residual components.

Read-only over git-tracked sources at a revision (CI-portable). Writes a
JSON snapshot with --output; --check fails on drift (source_sha ignored).

Sibling of inventory_workspace_member_i18n.py for surfaces previously excluded
from shell-home / public-guest / workspace-member scanners: feature `server/`
RSC screens plus residual interactive components not covered by those scopes.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Feature RSC/server screens (directories) + residual components not yet gated.
SCAN_PATHS = (
    "site/src/features/accounts/server",
    "site/src/features/commerce/server",
    "site/src/features/community/server",
    "site/src/features/discovery/server",
    "site/src/features/library/server",
    "site/src/features/moderation/server",
    "site/src/features/notifications/server",
    "site/src/features/organizations/server",
    "site/src/features/resources/server",
    "site/src/features/servers/server",
    "site/src/features/shell/server",
    "site/src/features/support/server",
    "site/src/features/trust/server",
    # Residual interactive components outside guest/workspace-member inventories.
    "site/src/features/community/components/community-report-groups.tsx",
    "site/src/features/community/components/community-report-history.tsx",
    "site/src/features/community/components/discussion-comment-actions.tsx",
    "site/src/features/community/components/object-mute-controls.tsx",
    "site/src/features/community/components/report-evidence-links.tsx",
    "site/src/features/resources/components/admin-resource-qa-report-actions.tsx",
    "site/src/features/resources/components/author-resource-forms.tsx",
    "site/src/features/resources/components/build-package-evidence.tsx",
    "site/src/features/resources/components/mta-meta-inspector-panel.tsx",
    "site/src/features/resources/components/resource-cart-review-evidence.tsx",
    "site/src/features/resources/components/resource-copy-metadata.tsx",
    "site/src/features/resources/components/resource-moderation-controls.tsx",
    "site/src/features/resources/components/resource-publication-readiness-panel.tsx",
    "site/src/features/resources/components/resource-publisher-filters.tsx",
    "site/src/features/resources/components/resource-publisher-workspace-nav.tsx",
    "site/src/features/resources/components/resource-qa-report-form.tsx",
    "site/src/features/resources/components/resource-release-watch-batch-controls.tsx",
    "site/src/features/resources/components/resource-requirements-report-body.tsx",
    "site/src/features/resources/components/resource-submission-success.tsx",
    "site/src/features/resources/components/resource-variants-form.tsx",
    "site/src/features/servers/components/server-claim-control-panel.tsx",
    "site/src/features/servers/components/server-observation-period-controls.tsx",
    "site/src/features/servers/components/server-review-panel.tsx",
    "site/src/features/servers/components/server-statistics-export-button.tsx",
    "site/src/features/servers/components/server-workspace-nav.tsx",
    "site/src/features/support/components/support-case-actions.tsx",
    "site/src/features/support/components/support-status-history.tsx",
    "site/src/features/trust/components/public-user-trust.tsx",
)

LOCALE_COPY_TERNARY = re.compile(
    r"""locale\s*===\s*["'](?:ru|en)["']\s*\?\s*["']([^"']{2,})["']\s*:\s*["']([^"']{2,})["']""",
    re.MULTILINE,
)

LOCALE_TAG = re.compile(r"^(?:[a-z]{2}(?:-[A-Z]{2})?|[a-z]{2})$")

ARIA_LITERAL = re.compile(r"""aria-label\s*=\s*["']([^"']+)["']""")
TITLE_LITERAL = re.compile(r"""\btitle\s*=\s*["']([^"']+)["']""")
PLACEHOLDER_LITERAL = re.compile(r"""\bplaceholder\s*=\s*["']([^"']+)["']""")
ALT_LITERAL = re.compile(r"""\balt\s*=\s*["']([^"']+)["']""")

JSX_TEXT = re.compile(
    r"""(?<!=)>\s*([A-Za-zА-Яа-яЁё©][^<{]{0,80}?)\s*(?:\{|<)""",
)

JSX_TEXT_MULTILINE = re.compile(
    r""">\s*\n\s*([A-Za-zА-Яа-яЁё©][^\n<{]{0,80}?)\s*\n\s*<""",
)

JSX_TEXT_SPACE_GLUE = re.compile(
    r"""([A-Za-zА-Яа-яЁё]{2,})\{\s*["']\s*["']\s*\}""",
)

TEMPLATE_LITERAL = re.compile(r"""template\s*:\s*["']([^"']+)["']""")

UNKNOWN_MARKER = re.compile(r"""["']—["']""")

ALLOWLIST: tuple[dict[str, str], ...] = (
    {
        "id": "library.collection-history.unknown-marker-dash",
        "path": "site/src/features/library/server/collection-history-page.tsx",
        "kind": "unknown-marker",
        "text": "—",
    },
    {
        "id": "library.collection-receipt.unknown-marker-dash",
        "path": "site/src/features/library/server/collection-receipt-page.tsx",
        "kind": "unknown-marker",
        "text": "—",
    },
    {
        "id": "library.collections-history-view.unknown-marker-dash",
        "path": "site/src/features/library/server/library-collections-history-view.tsx",
        "kind": "unknown-marker",
        "text": "—",
    },
    {
        "id": "library.selection-batch.unknown-marker-dash",
        "path": "site/src/features/library/server/library-selection-batch-screen.tsx",
        "kind": "unknown-marker",
        "text": "—",
    },
    {
        "id": "resources.build-package-evidence.unknown-marker-dash",
        "path": "site/src/features/resources/components/build-package-evidence.tsx",
        "kind": "unknown-marker",
        "text": "—",
    },
    {
        "id": "resources.build-screen.unknown-marker-dash",
        "path": "site/src/features/resources/server/build-screen.tsx",
        "kind": "unknown-marker",
        "text": "—",
    },
    {
        "id": "resources.market-page.unknown-marker-dash",
        "path": "site/src/features/resources/server/market-page.tsx",
        "kind": "unknown-marker",
        "text": "—",
    },
    {
        "id": "resources.delivery-evidence.unknown-marker-dash",
        "path": "site/src/features/resources/server/resource-delivery-evidence.tsx",
        "kind": "unknown-marker",
        "text": "—",
    },
    {
        "id": "resources.review-report.unknown-marker-dash",
        "path": "site/src/features/resources/server/resource-review-report-screen.tsx",
        "kind": "unknown-marker",
        "text": "—",
    },
    {
        "id": "resources.versions-page.unknown-marker-dash",
        "path": "site/src/features/resources/server/versions-page.tsx",
        "kind": "unknown-marker",
        "text": "—",
    },
    {
        "id": "servers.review-panel.unknown-marker-dash",
        "path": "site/src/features/servers/components/server-review-panel.tsx",
        "kind": "unknown-marker",
        "text": "—",
    },
    {
        "id": "servers.history-panel.unknown-marker-dash",
        "path": "site/src/features/servers/server/server-history-panel.tsx",
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
    """Prefer the working tree when inventorying the current checkout."""
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
            if "honesty-surface" in path:
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
    if stripped in {"·", "|", "/", "#", "..."}:
        return True
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
            "Git-tracked feature server/ RSC screens plus residual interactive components "
            "not covered by shell-home / public-guest / workspace-member inventories — "
            "hard-coded member/staff-facing literals + locale copy ternaries."
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
        message = "Unallowlisted hard-coded strings in feature-server scope:\n" + "\n".join(
            extras[:80]
        )
        if args.check or args.output:
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
                f"Feature-server i18n inventory drift vs {args.check}.\n{details}\n"
                "Regenerate with: python3 planning/tools/inventory_feature_server_i18n.py "
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
