"""Inventory literal and escaped migration paths in a Git snapshot, never edit them."""
import argparse
import collections
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TERMS = ('apps/web', 'packages', 'tests', 'deploy', 'configs')


def inventory(revision):
    sha = subprocess.check_output(['git', 'rev-parse', revision], cwd=ROOT, text=True).strip()
    # Broad first pass also catches path.join(root, "packages", ...) and regex literals.
    command = ['git', 'grep', '-n', '-I']
    for term in ('apps', *TERMS[1:]):
        command += ['-e', term]
    result = subprocess.run(command + [sha, '--', '.'], cwd=ROOT, text=True, capture_output=True)
    if result.returncode not in (0, 1):
        raise RuntimeError(result.stderr)
    files = {}
    for entry in result.stdout.splitlines():
        _, path, line, text = entry.split(':', 3)
        matches = []
        for term in TERMS:
            escaped = re.escape(term).replace('/', r'(?:\\?/)')
            if re.search(r'(?<![\w-])' + escaped + r'(?=(?:\\?/)|["\x27]|$)', text):
                matches.append(term)
        if matches:
            category = ('historical_snapshot' if path.startswith('planning/import-baseline/')
                        else 'documentation_or_planning' if path.startswith(('docs/', 'planning/')) or path.endswith('.md')
                        else 'programmatic')
            record = files.setdefault(path, {'category': category, 'references': {}})
            for term in matches:
                record['references'].setdefault(term, []).append(int(line))
    counts = collections.Counter()
    for record in files.values():
        for term in record['references']:
            counts[term] += 1
    return {'source_sha': sha,
            'scope': 'Tracked text at source_sha; literal/escaped paths and quoted path segments. Dynamic construction requires semantic review. Historical evidence is not a replacement list.',
            'files_per_term': dict(sorted(counts.items())), 'files': dict(sorted(files.items()))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--revision', default='HEAD')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    data = inventory(args.revision)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'source_sha': data['source_sha'], 'files': len(data['files']), 'files_per_term': data['files_per_term']}))


if __name__ == '__main__':
    main()
