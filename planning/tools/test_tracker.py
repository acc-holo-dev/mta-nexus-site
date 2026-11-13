"""Negative live-contract and non-destructive rendering tests (no database)."""
import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from check_tracker import ROOT, load, load_commit_tasks, validate_contract, validate_specifications


class TrackerContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = load(ROOT / 'planning/tasks.json')
        cls.schema = load(ROOT / 'planning/task-schema.json')
        cls.frozen = load(ROOT / 'planning/import-baseline/tasks.json')
        cls.amendments = load(ROOT / 'planning/spec-amendments.json')

    def assert_invalid(self, mutate, marker):
        data = copy.deepcopy(self.data)
        mutate(data)
        problems = validate_contract(data, self.schema)
        self.assertTrue(any(marker in problem for problem in problems), problems)

    def test_current_contract(self):
        self.assertEqual(validate_contract(self.data, self.schema), [])
        self.assertEqual(len(self.data['tasks']), 83)
        self.assertEqual(self.data['baseline_sha'], '385e577e7443cf7d7b817419ce5c3b8afe87b690')

    def test_required_root(self):
        self.assert_invalid(lambda d: d.pop('tasks'), 'required')

    def test_invalid_id(self):
        self.assert_invalid(lambda d: d['tasks'][0].update(id='ARCH-01'), 'schema')

    def test_metadata_shape(self):
        self.assert_invalid(lambda d: d.update(baseline_sha='current-head'), 'schema')
        self.assert_invalid(lambda d: d['tracker'].update(mode='issues'), 'schema')
        self.assert_invalid(lambda d: d.update(tasks=[]), 'schema')

    def test_task_shape(self):
        self.assert_invalid(lambda d: d['tasks'].__setitem__(0, None), 'schema')

    def test_duplicate_id(self):
        self.assert_invalid(lambda d: d['tasks'].append(copy.deepcopy(d['tasks'][0])), 'Duplicate')

    def test_unknown_dependency(self):
        self.assert_invalid(lambda d: d['tasks'][0]['dependencies'].append('DOC-99'), 'invalid dependency')

    def test_self_dependency(self):
        self.assert_invalid(lambda d: d['tasks'][0]['dependencies'].append('DOC-01'), 'invalid dependency')

    def test_cycle(self):
        # DOC-02 already depends on DOC-01.
        self.assert_invalid(lambda d: d['tasks'][0]['dependencies'].append('DOC-02'), 'cycle')

    def test_conditional_dependency(self):
        self.assert_invalid(lambda d: d['tasks'][0].update(conditional_dependencies=[{'id': 'DOC-99', 'when': 'new SQL'}]), 'invalid dependency')

    def test_duplicate_dependency(self):
        self.assert_invalid(lambda d: d['tasks'][1]['dependencies'].append('DOC-01'), 'non-unique')

    def test_required_task_fields(self):
        self.assert_invalid(lambda d: d['tasks'][0].pop('acceptance'), 'required')

    def test_status_enums(self):
        for field in ('execution_state', 'queue_state', 'decision_status', 'permission', 'phase', 'priority'):
            with self.subTest(field=field):
                self.assert_invalid(lambda d: d['tasks'][0].update({field: 'invalid'}), 'schema')

    def test_invalid_field_types(self):
        for field, value in [('title', 7), ('dependencies', 'DOC-01'), ('verification', [False]), ('source_ids', [None]), ('evidence', [{'path': 42, 'lines': []}])]:
            with self.subTest(field=field):
                self.assert_invalid(lambda d: d['tasks'][0].update({field: value}), 'schema')

    def test_empty_acceptance(self):
        self.assert_invalid(lambda d: d['tasks'][0].update(acceptance=[]), 'schema')

    def test_invalid_json_cli(self):
        with tempfile.TemporaryDirectory() as directory:
            plan = Path(directory) / 'planning'
            plan.mkdir()
            (plan / 'tasks.json').write_text('{')
            result = subprocess.run([sys.executable, str(ROOT / 'planning/tools/check_tracker.py'), '--repo', directory], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(json.loads(result.stdout)['status'], 'FAIL')

    def check_specs(self, data=None, amendments=None, loader=None):
        return validate_specifications(
            self.data if data is None else data, self.frozen,
            self.amendments if amendments is None else amendments,
            loader or (lambda commit: load_commit_tasks(ROOT, commit)),
        )

    def test_recorded_specifications_have_git_evidence(self):
        self.assertEqual(self.check_specs(), [])

    def test_unrecorded_specification_drift(self):
        data = copy.deepcopy(self.data)
        data['tasks'][0]['acceptance'].append('unreviewed acceptance')
        self.assertTrue(any('unrecorded' in p for p in self.check_specs(data=data)))

    def test_amended_field_cannot_silently_change_again(self):
        data = copy.deepcopy(self.data)
        task = next(t for t in data['tasks'] if t['id'] == 'OPS-13')
        task['verification'].append('new unrecorded verification')
        self.assertTrue(any('digest mismatch' in p for p in self.check_specs(data=data)))

    def test_amendment_digest_cannot_be_forged_without_git_evidence(self):
        amendments = copy.deepcopy(self.amendments)
        amendments['amendments'][0]['commit'] = self.data['baseline_sha']
        self.assertTrue(any('Git evidence mismatch' in p for p in self.check_specs(amendments=amendments)))

    def test_changing_both_live_value_and_digest_still_requires_commit_proof(self):
        from check_tracker import value_digest
        data = copy.deepcopy(self.data)
        amendments = copy.deepcopy(self.amendments)
        task = next(t for t in data['tasks'] if t['id'] == 'OPS-13')
        task['verification'].append('uncommitted verification')
        amendments['amendments'][0]['value_sha256'] = value_digest(task['verification'])
        self.assertTrue(any('Git evidence mismatch' in p for p in self.check_specs(data=data, amendments=amendments)))

    def test_unavailable_git_evidence_fails(self):
        def missing(commit):
            raise OSError('commit unavailable')
        self.assertTrue(any('Git evidence mismatch' in p for p in self.check_specs(loader=missing)))

    def test_duplicate_and_stale_amendments(self):
        amendments = copy.deepcopy(self.amendments)
        amendments['amendments'].append(copy.deepcopy(amendments['amendments'][0]))
        self.assertTrue(any('Duplicate amendment' in p for p in self.check_specs(amendments=amendments)))
        amendments = copy.deepcopy(self.amendments)
        amendments['amendments'][0]['id'] = 'DOC-99'
        self.assertTrue(any('stale amendment' in p for p in self.check_specs(amendments=amendments)))

    def test_amendment_schema_and_baseline_are_checked(self):
        for field, value in [('baseline_sha', '0' * 40), ('amendments', None)]:
            amendments = copy.deepcopy(self.amendments)
            amendments[field] = value
            self.assertTrue(any('Amendment schema' in p for p in self.check_specs(amendments=amendments)))
        amendments = copy.deepcopy(self.amendments)
        amendments['amendments'][0]['field'] = 'permission'
        self.assertTrue(any('Amendment schema' in p for p in self.check_specs(amendments=amendments)))

    def test_full_audit_cli(self):
        result = subprocess.run([sys.executable, str(ROOT / 'planning/tools/check_tracker.py')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report['status'], 'PASS')
        self.assertEqual(sum(report['execution_counts'].values()), report['tasks'])

    def test_frozen_manifest_rejects_byte_changes(self):
        import shutil
        with tempfile.TemporaryDirectory() as directory:
            plan = Path(directory) / 'planning'
            plan.mkdir()
            for name in ('tasks.json', 'task-schema.json', 'source-register.json', 'spec-amendments.json'):
                shutil.copyfile(ROOT / 'planning' / name, plan / name)
            shutil.copytree(ROOT / 'planning/import-baseline', plan / 'import-baseline')
            target = plan / 'import-baseline/tasks.json'
            target.write_bytes(target.read_bytes() + b'\n')
            result = subprocess.run([sys.executable, str(ROOT / 'planning/tools/check_tracker.py'), '--repo', directory], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertIn('baseline hash drift tasks.json', json.loads(result.stdout)['problems'])

    def test_repository_views_match_canonical_renderer(self):
        result = subprocess.run([sys.executable, str(ROOT / 'planning/tools/render_backlog.py'), '--check'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_renderer_formatter_failure_preserves_existing_views(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'ROADMAP.md'
            target.write_text('previous reviewed document\n')
            result = subprocess.run([sys.executable, str(ROOT / 'planning/tools/render_backlog.py'), '--output-dir', directory, '--biome-cli', str(Path(directory) / 'missing-biome')], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(target.read_text(), 'previous reviewed document\n')

    def test_frozen_formatting_contract(self):
        cli = os.environ.get('NEXUS_BIOME_CLI', str(ROOT / 'node_modules/@biomejs/biome/bin/biome'))
        files = [str(ROOT / 'planning/import-baseline' / name) for name in ('tasks.json', 'task-schema.json', 'source-register.json')]
        result = subprocess.run(['node', cli, 'format', '--no-errors-on-unmatched', *files], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_formatter_failure_on_second_view_publishes_nothing(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            for name in ('ROADMAP.md', 'TASKS.md', 'TRACEABILITY.md'):
                (folder / name).write_text('previous reviewed document\n')
            fake = folder / 'failing-biome.cjs'
            version = json.loads((ROOT / 'package.json').read_text())['devDependencies']['@biomejs/biome']
            fake.write_text(
                'if (process.argv.includes("--version")) { console.log(' + json.dumps('Version: ' + version) + '); } '
                'else if (process.argv.some(arg => arg.endsWith("TASKS.md"))) { process.exit(1); } '
                'else { process.stdin.pipe(process.stdout); }'
            )
            result = subprocess.run([sys.executable, str(ROOT / 'planning/tools/render_backlog.py'), '--output-dir', directory, '--biome-cli', str(fake)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Biome formatting failed for TASKS.md', result.stderr)
            for name in ('ROADMAP.md', 'TASKS.md', 'TRACEABILITY.md'):
                self.assertEqual((folder / name).read_text(), 'previous reviewed document\n')

    def test_renderer_deterministic_and_read_only_check(self):
        script = str(ROOT / 'planning/tools/render_backlog.py')
        with tempfile.TemporaryDirectory() as directory:
            command = [sys.executable, script, '--output-dir', directory]
            subprocess.run(command, check=True, capture_output=True)
            paths = sorted(Path(directory).glob('*.md'))
            self.assertEqual(len(paths), 3)
            original = {p.name: p.read_bytes() for p in paths}
            subprocess.run(command, check=True, capture_output=True)
            self.assertEqual(original, {p.name: p.read_bytes() for p in paths})
            subprocess.run(command + ['--check'], check=True, capture_output=True)
            target = Path(directory) / 'ROADMAP.md'
            target.write_text('intentional drift\n')
            result = subprocess.run(command + ['--check'], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(json.loads(result.stdout.splitlines()[-1])['stale'], ['ROADMAP.md'])
            self.assertEqual(target.read_text(), 'intentional drift\n')
            for p in paths:
                if p != target:
                    self.assertEqual(p.read_bytes(), original[p.name])


if __name__ == '__main__':
    unittest.main()
