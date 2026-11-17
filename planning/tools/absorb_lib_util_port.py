#!/usr/bin/env python3
"""Absorb one site/src/lib/<name>.ts into features/<feat>/<name>.ts as a util public port."""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def sh(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, cwd=ROOT, text=True)


def insert_alt(ports: str, name: str, feature: str) -> str:
    if re.search(rf"(?:^|\|){re.escape(name)}(?:\||$)", ports):
        return ports
    # Prefer stable anchors to avoid splitting nested (?:...)-server groups.
    anchors = {
        "resources": ["|server|", "|mta-version-target|", "|resource-submission-intent|", "|evidence|"],
        "servers": ["|statistics-server|", "|server-review-confirmation|", "|claim-controls|", "|follow|"],
        "commerce": ["|license-history-server|", "|subscription-confirmation|", "|seller-sales|", "|plan-reviews|"],
        "library": ["|release-comparison-server|", "|library-collection-manifests-i18n|", "|library-selection-batches-i18n|"],
        "community": ["|reports-server|", "|follow-confirmation|", "|discussion-mutation-confirmation|", "|follow|"],
        "organizations": ["|content-editor-server|", "|organization-member-confirmation|", "|history-view|"],
        "accounts": ["|public-profile-activity-server|", "|ad-preference|", "|settings-client-api|"],
        "moderation": ["|verification-moderation|", "|admin-status-labels|"],
        "notifications": ["|notification-inbox-export-client|", "|visible-polling|", "|preferences|"],
        "support": ["|center-server|"],
    }
    wrapped = f"|{ports}|"
    for anchor in anchors.get(feature, []):
        if anchor in wrapped:
            return wrapped.replace(anchor, f"|{name}{anchor}", 1).strip("|")
    return ports + "|" + name


def rewrite_relative_lib_imports(dst: Path) -> None:
    text = dst.read_text()
    def repl(m: re.Match[str]) -> str:
        target = m.group(1)
        # keep feature-local imports if they already exist beside dst
        base = target[2:]
        local = dst.parent / (base if base.endswith(".ts") else base + ".ts")
        if local.exists() or (dst.parent / base).exists():
            return m.group(0)
        return f'from "../../lib/{base}"'
    new = re.sub(r'''from ["'](\./[^"']+)["']''', repl, text)
    if new != text:
        dst.write_text(new)


def rewrite_imports(name: str, feat: str) -> None:
    try:
        files = sh(["rg", "-l", name, "site"]).splitlines()
    except subprocess.CalledProcessError:
        files = []
    dst = ROOT / f"site/src/features/{feat}/{name}.ts"
    feat_root = ROOT / f"site/src/features/{feat}"
    for rel in files:
        path = ROOT / rel
        if not path.is_file() or path.resolve() == dst.resolve():
            continue
        text = path.read_text()
        orig = text
        text = re.sub(
            rf'(from ["\'])((?:\.\./)+)lib/{re.escape(name)}(["\'])',
            rf"\1\2features/{feat}/{name}\3",
            text,
        )
        text = re.sub(
            rf'(read\(["\'])site/src/lib/{re.escape(name)}\.ts(["\'])',
            rf"\1site/src/features/{feat}/{name}.ts\2",
            text,
        )
        text = re.sub(
            rf'(["\'])\.\./\.\./src/lib/{re.escape(name)}(["\'])',
            rf"\1../../src/features/{feat}/{name}\2",
            text,
        )
        try:
            path.relative_to(feat_root)
            in_feat = True
        except ValueError:
            in_feat = False
        if in_feat:
            import os

            rel_imp = Path(os.path.relpath(dst.with_suffix(""), path.parent)).as_posix()
            if not rel_imp.startswith("."):
                rel_imp = "./" + rel_imp
            text = re.sub(
                rf'from ["\'](?:\.\./)*features/{re.escape(feat)}/{re.escape(name)}["\']',
                f'from "{rel_imp}"',
                text,
            )
        if text != orig:
            path.write_text(text)


def patch_depcruise(feat: str, name: str, isolation: str) -> None:
    path = ROOT / ".dependency-cruiser.cjs"
    text = path.read_text()

    # public API
    pub = f'name: "{feat}-feature-public-api"'
    idx = text.find(pub)
    if idx < 0:
        raise SystemExit(f"missing {pub}")
    m = re.search(r"\(\?\!\(\?:(.+?)\)\\\\\.ts\$", text[idx : idx + 2500], re.S)
    if not m:
        raise SystemExit(f"public alt missing for {feat}")
    ports = insert_alt(m.group(1), name, feat)
    text = text[: idx + m.start(1)] + ports + text[idx + m.end(1) :]

    builtins = isolation.replace("-isolation", "-has-no-node-builtins")
    for rule in (isolation, builtins):
        ridx = text.find(f'name: "{rule}"')
        if ridx < 0:
            continue
        fm = re.search(
            r'from:\s*(?:\{\s*path:\s*"(\^site/src/features/[^"]+)"|path:\s*"(\^site/src/features/[^"]+)")',
            text[ridx : ridx + 8000],
        )
        if not fm:
            # fallback: first features path in rule
            fm = re.search(
                r'path: "(\^site/src/features/[^"]+)"',
                text[ridx : ridx + 8000],
            )
            if not fm:
                continue
            fpath = fm.group(1)
            fstart, fend = fm.start(1), fm.end(1)
        else:
            fpath = fm.group(1) or fm.group(2)
            fstart = fm.start(1) if fm.group(1) is not None else fm.start(2)
            fend = fm.end(1) if fm.group(1) is not None else fm.end(2)
        if re.search(rf"(?:^|[|()])(?:{re.escape(name)})(?:[|)]|\\)", fpath):
            new_fpath = fpath
        else:
            token = ")\\\\.ts$"
            if token not in fpath:
                raise SystemExit(f"unexpected from-path for {rule}: {fpath[-80:]}")
            new_fpath = fpath.replace(token, f"|{name}{token}", 1)
        text = text[: ridx + fstart] + new_fpath + text[ridx + fend :]

        if not rule.endswith("-isolation"):
            continue
        # Remove from safe allowlist in the to.path only (never touch from.path).
        nxt = text.find('name: "', ridx + len(rule) + 10)
        block = text[ridx:nxt]
        to_m = re.search(r'to:\s*\{\s*path:\s*"([^"]+)"', block)
        if to_m and name in to_m.group(1):
            to_path = to_m.group(1)
            to_path2 = re.sub(rf"\|{re.escape(name)}(?=\||\))", "", to_path)
            to_path2 = re.sub(rf"\|{re.escape(name)}\\\\.ts\$", "", to_path2)
            block = block[: to_m.start(1)] + to_path2 + block[to_m.end(1) :]
            text = text[:ridx] + block + text[nxt:]

    path.write_text(text)


def ensure_util_ports_array(text: str) -> str:
    if "const utilPorts" in text:
        return text
    if "const clientPorts" in text:
        return text.replace("const clientPorts", "const utilPorts = [];\nconst clientPorts", 1)
    if "const ports =" in text:
        return text.replace("const ports =", "const utilPorts = [];\nconst ports =", 1)
    raise SystemExit("cannot find ports array")


def add_to_util_ports(text: str, name: str) -> str:
    text = ensure_util_ports_array(text)
    # extract utilPorts block
    m = re.search(r"const utilPorts = (\[[^\]]*\])", text, re.S)
    if not m:
        raise SystemExit("utilPorts parse failed")
    block = m.group(1)
    if f'"{name}"' in block:
        return text
    if block.strip() == "[]":
        new_block = f'[\n  "{name}",\n]'
    else:
        new_block = block.rstrip()
        # Avoid creating an empty slot when the last element already has a trailing comma.
        new_block = re.sub(r",?\s*\]\s*$", f',\n  "{name}",\n]', new_block)
    return text[: m.start(1)] + new_block + text[m.end(1) :]


def wire_util_loops(text: str, feat: str) -> str:
    if feat == "community":
        text = text.replace(
            "for (const port of ports)",
            "for (const port of [...ports, ...utilPorts])",
        )
        text = text.replace("ports.map(", "[...ports, ...utilPorts].map(")
    else:
        text = text.replace(
            "for (const port of clientPorts)",
            "for (const port of [...clientPorts, ...utilPorts])",
        )
        text = text.replace("clientPorts.map(", "[...clientPorts, ...utilPorts].map(")
    # avoid double-wrapping
    text = text.replace(
        "[...[...clientPorts, ...utilPorts], ...utilPorts]",
        "[...clientPorts, ...utilPorts]",
    )
    text = text.replace(
        "[...[...ports, ...utilPorts], ...utilPorts]",
        "[...ports, ...utilPorts]",
    )
    text = text.replace(
        "for (const port of [...[...clientPorts, ...utilPorts], ...utilPorts])",
        "for (const port of [...clientPorts, ...utilPorts])",
    )
    text = text.replace(
        "for (const port of [...[...ports, ...utilPorts], ...utilPorts])",
        "for (const port of [...ports, ...utilPorts])",
    )
    return text


def remove_from_safe_lib(text: str, name: str) -> str:
    return re.sub(rf"\|{re.escape(name)}(?=\||\))", "", text)


def patch_standard_boundary(feat: str, name: str) -> None:
    files = {
        "library": "scripts/tests/library-feature-boundaries.node-test.mjs",
        "community": "scripts/tests/community-feature-boundaries.node-test.mjs",
        "commerce": "scripts/tests/commerce-feature-boundaries.node-test.mjs",
        "organizations": "scripts/tests/organizations-feature-boundaries.node-test.mjs",
        "notifications": "scripts/tests/notifications-feature-boundaries.node-test.mjs",
        "moderation": "scripts/tests/moderation-feature-boundaries.node-test.mjs",
    }
    rel = files.get(feat)
    if not rel:
        return
    path = ROOT / rel
    text = path.read_text()
    text = add_to_util_ports(text, name)
    text = wire_util_loops(text, feat)
    text = remove_from_safe_lib(text, name)
    # skip use client for util ports if pattern exists
    if "utilPortSet" not in text and 'assert.match(readFileSync(resolve(root, entry), "utf8"), /^"use client";/u)' in text:
        text = text.replace(
            'assert.match(readFileSync(resolve(root, entry), "utf8"), /^"use client";/u);',
            'const portName = entry.split("/").pop().replace(/\\.ts$/u, "");\n'
            '      if (!(typeof utilPorts !== "undefined" && utilPorts.includes(portName)))\n'
            '        assert.match(readFileSync(resolve(root, entry), "utf8"), /^"use client";/u);',
        )
    path.write_text(text)


def patch_resources(name: str) -> None:
    path = ROOT / "scripts/tests/resources-feature-boundaries.node-test.mjs"
    text = path.read_text()
    marker = "resource-submission-intent"
    if f'"{name}"' in text:
        path.write_text(text)
        return
    text = text.replace(f'"{marker}",', f'"{marker}",\n    "{name}",')
    text = text.replace(
        f'["features/resources/{marker}.ts", "resources-view-isolation"],',
        f'["features/resources/{marker}.ts", "resources-view-isolation"],\n'
        f'    ["features/resources/{name}.ts", "resources-view-isolation"],',
    )
    text = text.replace(f'"app/{marker}.ts",', f'"app/{marker}.ts",\n    "app/{name}.ts",')
    text = text.replace(
        f'"site/src/features/resources/{marker}.ts",',
        f'"site/src/features/resources/{marker}.ts",\n    "site/src/features/resources/{name}.ts",',
    )
    needle = (
        f'readFileSync(resolve(root, "site/src/features/resources/{marker}.ts"), "utf8"),\n'
        '    /^"use client";/u,\n'
        "  );"
    )
    if needle in text:
        text = text.replace(
            needle,
            needle
            + f'\n  assert.doesNotMatch(\n    readFileSync(resolve(root, "site/src/features/resources/{name}.ts"), "utf8"),\n'
            '    /^"use client";/u,\n  );',
        )
    text = text.replace(
        f'visit("site/src/features/resources/{marker}.ts");',
        f'visit("site/src/features/resources/{marker}.ts");\n  visit("site/src/features/resources/{name}.ts");',
    )
    path.write_text(text)


def patch_servers(name: str) -> None:
    path = ROOT / "scripts/tests/servers-feature-boundaries.node-test.mjs"
    text = path.read_text()
    marker = "claim-controls"
    if f'"{name}"' in text and f"features/servers/{name}.ts" in text:
        text = remove_from_safe_lib(text, name)
        path.write_text(text)
        return
    text = text.replace(f'"{marker}",', f'"{marker}",\n    "{name}",', 1)
    text = text.replace(
        f'["features/servers/{marker}.ts", "servers-client-isolation"],',
        f'["features/servers/{marker}.ts", "servers-client-isolation"],\n'
        f'    ["features/servers/{name}.ts", "servers-client-isolation"],',
    )
    text = text.replace(f'"app/{marker}.ts",', f'"app/{marker}.ts",\n    "app/{name}.ts",')
    text = text.replace(
        f'"site/src/features/servers/{marker}.ts",',
        f'"site/src/features/servers/{marker}.ts",\n    "site/src/features/servers/{name}.ts",',
    )
    text = text.replace(
        f'visit("site/src/features/servers/{marker}.ts");',
        f'visit("site/src/features/servers/{marker}.ts");\n  visit("site/src/features/servers/{name}.ts");',
    )
    # fixture write loop: find array containing claim-controls used for writes
    text = remove_from_safe_lib(text, name)
    path.write_text(text)


def patch_remaining_feature(feat: str, name: str, *, util_key: str = "clientUtilPorts") -> None:
    path = ROOT / "scripts/tests/remaining-features-boundaries.node-test.mjs"
    text = path.read_text()
    mfeat = re.search(
        rf'name: "{re.escape(feat)}",.*?(?=\n  \{{|\n\];)',
        text,
        re.S,
    )
    if not mfeat:
        raise SystemExit(f"remaining feature block missing: {feat}")
    block = mfeat.group(0)
    orig = block
    um = re.search(rf"{util_key}: (\[[^\]]*\])", block, re.S)
    if um:
        arr = um.group(1)
        if f'"{name}"' not in arr:
            if arr.strip() == "[]":
                narr = f'["{name}"]'
            else:
                narr = re.sub(r"\]\s*$", f', "{name}"]', arr.rstrip())
            block = block[: um.start(1)] + narr + block[um.end(1) :]
    else:
        inserted = False
        for key in ("clients", "clientPorts", "privateClients"):
            km = re.search(rf"{key}: (\[[^\]]*\],)", block, re.S)
            if not km:
                continue
            insert = f'\n    {util_key}: ["{name}"],'
            block = block[: km.end(0)] + insert + block[km.end(0) :]
            inserted = True
            break
        if not inserted:
            raise SystemExit(f"cannot insert {util_key} for {feat}")
    sm = re.search(r'safe: "([^"]+)"', block)
    if sm and name in sm.group(1).split("|"):
        parts = [p for p in sm.group(1).split("|") if p != name]
        block = block[: sm.start(1)] + "|".join(parts) + block[sm.end(1) :]
    if block == orig and f'"{name}"' not in block:
        raise SystemExit(f"failed to patch remaining {feat}/{name}")
    text = text[: mfeat.start()] + block + text[mfeat.end() :]
    path.write_text(text)


def patch_accounts(name: str) -> None:
    patch_remaining_feature("accounts", name)


def patch_readme(feat: str, name: str) -> None:
    path = ROOT / f"site/src/features/{feat}/README.md"
    if not path.exists():
        return
    text = path.read_text()
    if f"`{name}.ts`" in text:
        return
    row = f"| `{name}.ts` | util port `{name}` |\n"
    lines = text.splitlines(True)
    out = []
    inserted = False
    for i, line in enumerate(lines):
        out.append(line)
        if (
            not inserted
            and line.startswith("| `")
            and i + 1 < len(lines)
            and not lines[i + 1].startswith("|")
        ):
            out.append(row)
            inserted = True
    path.write_text("".join(out) if inserted else text + row)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--feature", required=True)
    ap.add_argument("--isolation", default="")
    args = ap.parse_args()
    name, feat = args.name, args.feature
    isolation = args.isolation or (
        "resources-view-isolation" if feat == "resources" else f"{feat}-client-isolation"
    )
    src = ROOT / f"site/src/lib/{name}.ts"
    dst = ROOT / f"site/src/features/{feat}/{name}.ts"
    if src.exists() and not dst.exists():
        sh(["git", "mv", str(src.relative_to(ROOT)), str(dst.relative_to(ROOT))])
    elif dst.exists():
        print(f"resume {name}: already moved")
    else:
        raise SystemExit(f"missing {src}")
    rewrite_imports(name, feat)
    rewrite_relative_lib_imports(dst)
    patch_depcruise(feat, name, isolation)
    if feat == "resources":
        patch_resources(name)
    elif feat == "servers":
        patch_servers(name)
    elif feat == "accounts":
        patch_accounts(name)
    elif feat == "support":
        patch_remaining_feature("support", name)
    elif feat == "moderation":
        patch_standard_boundary(feat, name)
        patch_remaining_feature("moderation", name)
    else:
        patch_standard_boundary(feat, name)
    patch_readme(feat, name)
    print(f"OK {name} → {feat}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
