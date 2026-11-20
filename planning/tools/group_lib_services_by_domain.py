#!/usr/bin/env python3
"""Group site/src/lib/services/*.ts into domain subfolders (TO-BE: services/<domain>/).

Keeps services under lib/services (ARCHITECTURE). Rewrites repo-wide import/mocks
that targeted the flat path, and rewrites peer ./ imports across domain boundaries.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SERVICES = ROOT / "site/src/lib/services"

# Explicit stem → domain (feature-aligned). Unlisted stems stay at root.
DOMAIN_BY_STEM: dict[str, str] = {
    # accounts
    "auth-service": "accounts",
    "profile-change-history-service": "accounts",
    "profile-privacy-service": "accounts",
    "public-profile-service": "accounts",
    "security-center-service": "accounts",
    # commerce
    "commerce-service": "commerce",
    "commercial-plan-service": "commerce",
    "order-case-service": "commerce",
    "order-terms-service": "commerce",
    "product-service": "commerce",
    "product-catalog-page.test": "commerce",
    "license-control-service": "commerce",
    "seller-sales-service": "commerce",
    "subscriptions-service": "commerce",
    "plan-reviews-service": "commerce",
    "resource-cart-receipts-service": "commerce",
    "resource-deliveries-service": "commerce",
    # community
    "community-moderation-service": "community",
    "community-report-groups-service": "community",
    "community-report-history-service": "community",
    "community-report-service": "community",
    "community-topic-recovery-service": "community",
    "content-reaction-service": "community",
    "content-service": "community",
    "discussion-follow-notification-service": "community",
    "discussion-notification-replay": "community",
    "discussion-replay-checkpoint": "community",
    "discussion-replay-worker": "community",
    "discussion-workspace-service": "community",
    "follow-workspace-service": "community",
    # discovery
    "discovery-service": "discovery",
    "publication-feed-service": "discovery",
    # library
    "library-collections-service": "library",
    "library-selection-batches-service": "library",
    # moderation
    "admin-service": "moderation",
    "storage-maintenance-service": "moderation",
    "verification-workspace-service": "moderation",
    "platform-report-service": "moderation",
    # notifications
    "notification-dispatch-service": "notifications",
    "notification-inbox-service": "notifications",
    "web-push-crypto": "notifications",
    "web-push-endpoint-policy": "notifications",
    "server-follow-notification-service": "notifications",
    # organizations
    "organization-content-service": "organizations",
    "organization-governance-service": "organizations",
    "organization-team-service": "organizations",
    "organization-workspace-service": "organizations",
    "author-content-service": "organizations",
    # resources
    "resource-activity-service": "resources",
    "resource-build-workspace-service": "resources",
    "resource-copy-service": "resources",
    "resource-image-normalization": "resources",
    "resource-management-service": "resources",
    "resource-media-service": "resources",
    "resource-publication-readiness-service": "resources",
    "resource-publisher-service": "resources",
    "resource-qa-service": "resources",
    "resource-release-control-service": "resources",
    "resource-release-watches-service": "resources",
    "resource-requirements-service": "resources",
    "resource-review-service": "resources",
    "build-package-inspection": "resources",
    "build-package-service": "resources",
    "build-scanner-service": "resources",
    "clamav-instream": "resources",
    "publication-editor-record": "resources",
    # servers
    "server-claim-service": "servers",
    "server-content-service": "servers",
    "server-history-service": "servers",
    "server-observation-collector": "servers",
    "server-observation-matching": "servers",
    "server-observation-sequence": "servers",
    "server-review-service": "servers",
    "server-service": "servers",
    "server-statistics-service": "servers",
    "server-workspace-history-service": "servers",
    "mta-master-directory-service": "servers",
    "mta-master-directory-service-harness": "servers",
    "mta-master-directory-service-endpoints.test": "servers",
    "mta-master-directory-service-observations.test": "servers",
    "mta-master-directory-service-parse.test": "servers",
    "mta-master-directory-service-transport.test": "servers",
    # support
    "support-message-discovery-service": "support",
    # trust
    "public-context-trust-service": "trust",
    "public-user-trust-service": "trust",
    "public-verification-history-service": "trust",
}


def stem_of(path: Path) -> str:
    name = path.name
    if name.endswith(".test.ts"):
        return name[: -len(".ts")]  # keep .test in stem key map
    if name.endswith(".mjs"):
        return name[: -len(".mjs")]
    if name.endswith(".ts"):
        return name[: -len(".ts")]
    return path.stem


def sh(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, cwd=ROOT, text=True)


def discover_moves() -> list[tuple[Path, Path, str]]:
    moves: list[tuple[Path, Path, str]] = []
    for path in sorted(SERVICES.iterdir()):
        if not path.is_file():
            continue
        if path.name in {".gitkeep", "README.md"}:
            continue
        stem = stem_of(path)
        # Map product-catalog-page.test.ts via DOMAIN_BY_STEM key
        domain = DOMAIN_BY_STEM.get(stem)
        if domain is None and stem.endswith(".test"):
            domain = DOMAIN_BY_STEM.get(stem)
        if domain is None:
            # prefix heuristics for any new files
            for prefix, dom in (
                ("resource-", "resources"),
                ("build-", "resources"),
                ("server-", "servers"),
                ("mta-", "servers"),
                ("organization-", "organizations"),
                ("community-", "community"),
                ("discussion-", "community"),
                ("notification-", "notifications"),
                ("library-", "library"),
                ("order-", "commerce"),
                ("product-", "commerce"),
            ):
                if stem.startswith(prefix) or path.name.startswith(prefix):
                    domain = dom
                    break
        if domain is None:
            continue
        dest_dir = SERVICES / domain
        dest = dest_dir / path.name
        if path.resolve() == dest.resolve():
            continue
        moves.append((path, dest, domain))
    return moves


def rewrite_text(text: str, stem_to_domain: dict[str, str]) -> str:
    """Rewrite flat lib/services/<stem> → lib/services/<domain>/<stem> in imports/mocks."""

    def repl_from(m: re.Match[str]) -> str:
        quote = m.group(1)
        prefix = m.group(2)  # path up through services/
        stem = m.group(3)
        domain = stem_to_domain.get(stem)
        if not domain:
            return m.group(0)
        return f"from {quote}{prefix}{domain}/{stem}{quote}"

    # from ".../lib/services/stem" or from "./services/stem" (lib root) etc.
    text = re.sub(
        r"""from\s+(["'])((?:(?:\.\./)+|\./)?(?:(?:src/)?lib/)?services/)([A-Za-z0-9._-]+)\1""",
        repl_from,
        text,
    )

    def repl_import(m: re.Match[str]) -> str:
        quote = m.group(1)
        prefix = m.group(2)
        stem = m.group(3)
        domain = stem_to_domain.get(stem)
        if not domain:
            return m.group(0)
        return f"import({quote}{prefix}{domain}/{stem}{quote}"

    text = re.sub(
        r"""import\(\s*(["'])((?:(?:\.\./)+|\./)?(?:(?:src/)?lib/)?services/)([A-Za-z0-9._-]+)\1""",
        repl_import,
        text,
    )

    # vi.mock(".../lib/services/stem")
    def repl_mock(m: re.Match[str]) -> str:
        quote = m.group(1)
        prefix = m.group(2)
        stem = m.group(3)
        domain = stem_to_domain.get(stem)
        if not domain:
            return m.group(0)
        return f"{m.group(0)[: m.start(2) - m.start()]}{prefix}{domain}/{stem}{quote}"

    # Simpler mock/string path rewrite for services/stem without domain
    def repl_path_str(m: re.Match[str]) -> str:
        quote = m.group(1)
        prefix = m.group(2)
        stem = m.group(3)
        domain = stem_to_domain.get(stem)
        if not domain:
            return m.group(0)
        return f"{quote}{prefix}{domain}/{stem}{quote}"

    text = re.sub(
        r"""(["'])((?:(?:\.\./)+|\./)?(?:(?:src/)?lib/)?services/)([A-Za-z0-9._-]+)\1""",
        repl_path_str,
        text,
    )
    return text


def rewrite_peer_imports(dest: Path, stem_to_domain: dict[str, str], own_domain: str) -> None:
    text = dest.read_text()
    orig = text

    def repl(m: re.Match[str]) -> str:
        quote = m.group(1)
        stem = m.group(2)
        # strip extension if present in import
        clean = stem
        for ext in (".js", ".mjs", ".ts"):
            if clean.endswith(ext):
                clean = clean[: -len(ext)]
                break
        domain = stem_to_domain.get(clean)
        if domain is None:
            # peer still at services root
            if (SERVICES / f"{clean}.ts").exists() or (SERVICES / f"{clean}.mjs").exists():
                return f"from {quote}../{stem}{quote}"
            return m.group(0)
        if domain == own_domain:
            return f"from {quote}./{stem}{quote}"
        return f"from {quote}../{domain}/{stem}{quote}"

    text = re.sub(r"""from\s+(["'])\./([A-Za-z0-9._-]+)\1""", repl, text)
    if text != orig:
        dest.write_text(text)



def fix_import_depths(stem_to_domain: dict[str, str]) -> None:
    """After move into services/<domain>/, deepen ../ and ../../ escapes to lib/features."""
    domains = set(stem_to_domain.values())
    for domain in sorted(domains):
        d = SERVICES / domain
        if not d.is_dir():
            continue
        for path in d.rglob("*"):
            if not path.is_file() or path.suffix not in {".ts", ".tsx", ".mjs", ".js"}:
                continue
            text = path.read_text()
            orig = text

            def fix_from(m: re.Match[str]) -> str:
                q = m.group(1)
                rel = m.group(2)
                first = rel.split("/")[0]
                if first in domains or rel.startswith("./"):
                    return m.group(0)
                if rel.startswith("../") and not rel.startswith("../../"):
                    rest = rel[3:]
                    top = rest.split("/")[0]
                    if top in domains:
                        return m.group(0)
                    return f"from {q}../../{rest}{q}"
                if rel.startswith("../../") and not rel.startswith("../../../"):
                    rest = rel[6:]
                    return f"from {q}../../../{rest}{q}"
                return m.group(0)

            text = re.sub(r"""from\s+(['"])(\.\./[^'"]+)\1""", fix_from, text)
            if text != orig:
                path.write_text(text)



def apply(moves: list[tuple[Path, Path, str]], dry_run: bool) -> int:
    stem_to_domain: dict[str, str] = {}
    for src, dest, domain in moves:
        stem_to_domain[stem_of(src)] = domain
        # also map without .test for catalog page? already in map
        if src.name.endswith(".mjs"):
            stem_to_domain[src.name[: -len(".mjs")]] = domain

    print(f"moves={len(moves)} domains={sorted({d for _, _, d in moves})}")
    if dry_run:
        for src, dest, domain in moves:
            print(f"  {src.relative_to(ROOT)} -> {dest.relative_to(ROOT)}")
        return 0

    for src, dest, _domain in moves:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dest))

    for src, dest, domain in moves:
        rewrite_peer_imports(dest, stem_to_domain, domain)
    fix_import_depths(stem_to_domain)

    # Repo-wide path rewrite (site, scripts, package.json, docs references in tests)
    roots = ["site", "scripts", "package.json", "docs"]
    try:
        files = sh(["rg", "-l", r"lib/services/[A-Za-z0-9._-]+|/services/[A-Za-z0-9._-]+", *roots]).splitlines()
    except subprocess.CalledProcessError:
        files = []

    # Always include package.json
    for extra in ("package.json",):
        if extra not in files:
            files.append(extra)

    changed = 0
    for rel in files:
        path = ROOT / rel
        if not path.is_file():
            continue
        # skip already-moved destinations content already peer-fixed; still rewrite absolute flat refs
        text = path.read_text()
        new = rewrite_text(text, stem_to_domain)
        if new != text:
            path.write_text(new)
            changed += 1
            print(f"rewrote {rel}")
    print(f"files_rewritten={changed}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--domains",
        default="",
        help="Comma-separated domain filter (default: all mapped)",
    )
    args = ap.parse_args()
    moves = discover_moves()
    if args.domains:
        allow = {d.strip() for d in args.domains.split(",") if d.strip()}
        moves = [m for m in moves if m[2] in allow]
    if not moves:
        print("no moves", file=sys.stderr)
        return 1
    return apply(moves, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
