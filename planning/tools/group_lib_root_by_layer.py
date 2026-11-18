#!/usr/bin/env python3
"""Group site/src/lib/*.ts kernels into lib/http/ and lib/platform/ (TO-BE).

Leaves lib/i18n/ dictionaries and lib/services/<domain>/ alone. Rewrites
repo-wide import/mocks and deepens peer escapes after the extra directory.
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "site/src/lib"

LAYER_BY_STEM: dict[str, str] = {
    # http adapters / bounded body readers
    "auth-request-body": "http",
    "bounded-json": "http",
    "bounded-multipart": "http",
    "browser-request-guard": "http",
    "browser-request-policy": "http",
    "browser-route-adapter": "http",
    "license-bearer-route-adapter": "http",
    "private-api-request": "http",
    "public-platform-api": "http",
    # platform / shared non-UI
    "observability": "platform",
    "postgres-error": "platform",
    "offline-cache-policy": "platform",
    "i18n": "platform",
    "i18n-server": "platform",
    "home-personal-changes": "platform",
}

# Misplaced unit test at lib root → site/tests/unit
TEST_MOVES: dict[str, str] = {
    "support-response.test.ts": "site/tests/unit/support-response.test.ts",
}


def sh(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, cwd=ROOT, text=True)


def discover_moves() -> list[tuple[Path, Path, str]]:
    moves: list[tuple[Path, Path, str]] = []
    for path in sorted(LIB.iterdir()):
        if not path.is_file() or path.suffix != ".ts":
            continue
        if path.name in TEST_MOVES:
            dest = ROOT / TEST_MOVES[path.name]
            moves.append((path, dest, "tests"))
            continue
        stem = path.name[: -len(".ts")]
        if stem.endswith(".test"):
            continue
        layer = LAYER_BY_STEM.get(stem)
        if not layer:
            continue
        dest = LIB / layer / path.name
        moves.append((path, dest, layer))
    return moves


def rewrite_text(text: str, stem_to_layer: dict[str, str]) -> str:
    """Rewrite lib/<stem> → lib/<layer>/<stem>, avoiding lib/i18n/<locale> dictionary paths."""

    def repl_path(m: re.Match[str]) -> str:
        quote, prefix, stem, tail = m.group(1), m.group(2), m.group(3), m.group(4)
        # already layered?
        if stem in {"http", "platform", "services", "i18n"} and (
            tail.startswith("/") or (m.group(0).find(f"/{stem}/") != -1)
        ):
            # If match is lib/i18n/en — stem=i18n and next char in full match may be /
            pass
        layer = stem_to_layer.get(stem)
        if not layer:
            return m.group(0)
        # Do not rewrite dictionary tree imports: lib/i18n/en|ru|index
        if stem == "i18n" and tail.startswith("/"):
            return m.group(0)
        return f"{quote}{prefix}{layer}/{stem}{tail}{quote}" if False else f"{quote}{prefix}{layer}/{stem}{quote}"

    # from/import/mock string paths ending at stem (no trailing /locale)
    text = re.sub(
        r"""(["'])((?:(?:\.\./)+|\./)?(?:(?:src/)?lib/))([A-Za-z0-9_-]+)(\.[a-z]+)?\1""",
        lambda m: _repl_quoted(m, stem_to_layer),
        text,
    )
    # absolute site/src/lib/stem
    text = re.sub(
        r"""(["'])(site/src/lib/)([A-Za-z0-9_-]+)(\.[a-z]+)?\1""",
        lambda m: _repl_site(m, stem_to_layer),
        text,
    )
    return text


def _repl_quoted(m: re.Match[str], stem_to_layer: dict[str, str]) -> str:
    quote, prefix, stem, ext = m.group(1), m.group(2), m.group(3), m.group(4) or ""
    if stem in {"http", "platform", "services", "i18n"}:
        # lib/i18n as bare module should move; lib/i18n/… won't match this (no slash in stem group)
        # But prefix may be .../lib/ and stem i18n for the barrel — that SHOULD move.
        if stem != "i18n":
            return m.group(0)
    layer = stem_to_layer.get(stem)
    if not layer:
        return m.group(0)
    # Avoid double-prefix if already lib/platform/observability matched as stem=platform — won't
    return f"{quote}{prefix}{layer}/{stem}{ext}{quote}"


def _repl_site(m: re.Match[str], stem_to_layer: dict[str, str]) -> str:
    quote, prefix, stem, ext = m.group(1), m.group(2), m.group(3), m.group(4) or ""
    if stem in {"http", "platform", "services"}:
        return m.group(0)
    layer = stem_to_layer.get(stem)
    if not layer:
        return m.group(0)
    return f"{quote}{prefix}{layer}/{stem}{ext}{quote}"


def rewrite_peer_imports(dest: Path, stem_to_layer: dict[str, str], own_layer: str) -> None:
    if own_layer == "tests":
        # support-response.test imports from ../features/support — from site/tests/unit need ../../src/features
        text = dest.read_text()
        text2 = text.replace(
            'from "../features/support/support-response"',
            'from "../../src/features/support/support-response"',
        )
        if text2 != text:
            dest.write_text(text2)
        return

    text = dest.read_text()
    orig = text

    def repl(m: re.Match[str]) -> str:
        quote = m.group(1)
        target = m.group(2)  # may include /index
        stem = target.split("/")[0]
        # i18n/index stays relative to platform → ../i18n/index
        if stem == "i18n" and (target.startswith("i18n/") or target == "i18n"):
            if own_layer == "platform":
                if target == "i18n" or target.startswith("i18n/"):
                    return f"from {quote}../{target}{quote}"
            return f"from {quote}../{target}{quote}"
        layer = stem_to_layer.get(stem)
        if layer is None:
            # services/… or features via relative — deepen below
            if stem == "services":
                return f"from {quote}../{target}{quote}"
            if stem in {"features", "app"}:
                return m.group(0)
            # unknown ./foo left at lib root
            if (LIB / f"{stem}.ts").exists():
                return f"from {quote}../{target}{quote}"
            return m.group(0)
        if layer == own_layer:
            return f"from {quote}./{target}{quote}"
        return f"from {quote}../{layer}/{target}{quote}"

    text = re.sub(r"""from\s+(["'])\./([^"']+)\1""", repl, text)

    # deepen ../features and ../services already correct from lib root → need ../ again? 
    # From lib/platform: ../features was wrong (lib/features); old home-personal had ../features from lib root = src/features. 
    # After move to platform, need ../../features
    def deepen(m: re.Match[str]) -> str:
        quote, rel = m.group(1), m.group(2)
        top = rel.split("/")[0]
        if top in {"http", "platform", "services", "i18n"}:
            return m.group(0)
        if rel.startswith("../"):
            return m.group(0)  # handled carefully below
        return m.group(0)

    # Fix escapes that still look like lib-root relative
    def fix_escape(m: re.Match[str]) -> str:
        quote, rel = m.group(1), m.group(2)
        # ../http|platform|services|i18n — cross-layer already ok at one level
        first = rel.split("/")[0]
        if first in {"http", "platform", "services", "i18n"}:
            return m.group(0)
        # ../features / ../app from old lib root → ../../features
        if not rel.startswith("../"):
            # single ../X
            return f"from {quote}../{rel}{quote}"
        return m.group(0)

    # Apply deepen for ../features and similar (one level too shallow)
    def deepen_features(m: re.Match[str]) -> str:
        quote, rel = m.group(1), m.group(2)
        if rel.startswith("features/") or rel.startswith("app/"):
            return f"from {quote}../../{rel}{quote}"
        if rel.startswith("services/"):
            return f"from {quote}../{rel}{quote}"
        return m.group(0)

    text = re.sub(r"""from\s+(["'])\.\./(features/[^"']+|app/[^"']+|services/[^"']+)\1""", deepen_features, text)

    if text != orig:
        dest.write_text(text)


def apply(moves: list[tuple[Path, Path, str]], dry_run: bool) -> int:
    stem_to_layer = dict(LAYER_BY_STEM)
    print(f"moves={len(moves)} layers={sorted({m[2] for m in moves})}")
    if dry_run:
        for src, dest, layer in moves:
            print(f"  {src.relative_to(ROOT)} -> {dest.relative_to(ROOT)} ({layer})")
        return 0

    for src, dest, _layer in moves:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dest))

    for _src, dest, layer in moves:
        rewrite_peer_imports(dest, stem_to_layer, layer)

    try:
        files = sh(
            [
                "rg",
                "-l",
                r"lib/(auth-request-body|bounded-json|bounded-multipart|browser-request|browser-route|license-bearer|private-api-request|public-platform-api|observability|postgres-error|offline-cache-policy|i18n-server|home-personal-changes|/i18n[\"'])",
                "site",
                "scripts",
                "package.json",
            ]
        ).splitlines()
    except subprocess.CalledProcessError:
        files = []
    # broader sweep
    try:
        more = sh(["rg", "-l", r"src/lib/[a-z0-9-]+", "site", "scripts", "package.json"]).splitlines()
        files = sorted(set(files) | set(more))
    except subprocess.CalledProcessError:
        pass

    changed = 0
    for rel in files:
        path = ROOT / rel
        if not path.is_file():
            continue
        text = path.read_text()
        new = rewrite_text(text, stem_to_layer)
        # special: from "…/lib/i18n" barrel only (not i18n/en)
        new2 = re.sub(
            r"""(["'])((?:(?:\.\./)+|\./)?(?:(?:src/)?lib/))i18n\1""",
            lambda m: f"{m.group(1)}{m.group(2)}platform/i18n{m.group(1)}"
            if "platform/i18n" not in m.group(0)
            else m.group(0),
            new,
        )
        new2 = re.sub(
            r"""(["'])(site/src/lib/)i18n(\.[a-z]+)?\1""",
            lambda m: f"{m.group(1)}{m.group(2)}platform/i18n{m.group(3) or ''}{m.group(1)}",
            new2,
        )
        if new2 != text:
            path.write_text(new2)
            changed += 1
            print(f"rewrote {rel}")
    print(f"files_rewritten={changed}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    moves = discover_moves()
    if not moves:
        print("no moves", file=sys.stderr)
        return 1
    return apply(moves, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
