"""Check layered tracker, historical evidence and non-destructive generation."""
import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from check_tracker import ROOT, load, load_commit_tasks, tracker_tasks, validate_contract, validate_specifications, value_digest


class TrackerContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = load(ROOT / 'planning/tasks.json')
        cls.schema = load(ROOT / 'planning/task-schema.json')
        cls.frozen = load(ROOT / 'planning/import-baseline/tasks.json')
        cls.amendments = load(ROOT / 'planning/spec-amendments.json')

    def invalid(self, mutate, marker='schema'):
        data = copy.deepcopy(self.data)
        mutate(data)
        self.assertTrue(any(marker in problem for problem in validate_contract(data, self.schema)))

    def first(self, data):
        return data['layers']['live']['tasks'][0]

    def specs(self, data=None, amendments=None, loader=None):
        return validate_specifications(self.data if data is None else data, self.frozen,
            self.amendments if amendments is None else amendments,
            loader or (lambda commit: load_commit_tasks(ROOT, commit)))

    def test_current_contract(self):
        self.assertEqual(validate_contract(self.data, self.schema), [])
        self.assertEqual(len(tracker_tasks(self.data)), 83)
        self.assertEqual(self.data['baseline_sha'], self.frozen['baseline_sha'])

    def test_required_layers(self):
        self.invalid(lambda data: data.pop('layers'))

    def test_wrong_layer(self):
        self.invalid(lambda data: data['layers'].update(unknown={'count': 0, 'tasks': []}))

    def test_shadow_root_tasks(self):
        self.invalid(lambda data: data.update(tasks=[]))

    def test_layer_count(self):
        self.invalid(lambda data: data['layers']['live'].update(count=999), 'count mismatch')

    def test_duplicate_across_layers(self):
        def mutate(data):
            data['layers']['live']['tasks'].append(copy.deepcopy(data['layers']['history']['tasks'][0]))
            data['layers']['live']['count'] += 1
        self.invalid(mutate, 'Duplicate')

    def test_history_cannot_silently_reopen(self):
        self.invalid(lambda data: data['layers']['history']['tasks'][0].update(execution_state='not_started'), 'History')

    def test_unknown_dependency(self):
        self.invalid(lambda data: self.first(data)['dependencies'].append('DOC-99'), 'invalid dependency')

    def test_self_dependency(self):
        self.invalid(lambda data: self.first(data)['dependencies'].append(self.first(data)['id']), 'invalid dependency')

    def test_conditional_dependency(self):
        self.invalid(lambda data: self.first(data).update(conditional_dependencies=[{'id':'DOC-99','when':'SQL'}]), 'invalid dependency')

    def test_cycle_across_layers(self):
        def mutate(data):
            first = self.first(data)
            second = data['layers']['history']['tasks'][0]
            first['dependencies'] = [second['id']]
            second['dependencies'] = [first['id']]
        self.invalid(mutate, 'cycle')

    def test_duplicate_dependency(self):
        self.invalid(lambda data: self.first(data).update(dependencies=['DOC-01','DOC-01']))

    def test_status_enums(self):
        for field in ('execution_state','queue_state','decision_status','permission','phase','priority','ticket_status'):
            with self.subTest(field=field):
                self.invalid(lambda data: self.first(data).update({field:'invalid'}))

    def test_required_fields(self):
        for field in ('id','title','acceptance','verification','dependencies'):
            with self.subTest(field=field):self.invalid(lambda data: self.first(data).pop(field))

    def test_types(self):
        for field,value in [('title',7),('acceptance',[]),('dependencies','DOC-01'),('verification',[False]),('evidence',[{'path':42,'lines':[]}])]:
            with self.subTest(field=field):self.invalid(lambda data: self.first(data).update({field:value}))

    def test_invalid_id(self):
        self.invalid(lambda data:self.first(data).update(id='ARCH-01'))

    def test_current_specifications_have_git_evidence(self):
        self.assertEqual(self.specs(), [])

    def test_unrecorded_specification(self):
        data=copy.deepcopy(self.data);self.first(data)['acceptance'].append('unrecorded')
        self.assertTrue(any('unrecorded' in problem or 'digest mismatch' in problem for problem in self.specs(data=data)))

    def test_changing_digest_still_needs_commit(self):
        data=copy.deepcopy(self.data);amendments=copy.deepcopy(self.amendments)
        entry=amendments['amendments'][0];task=next(t for t in tracker_tasks(data) if t['id']==entry['id'])
        task[entry['field']] = ['uncommitted field value']
        entry['value_sha256']=value_digest(task[entry['field']])
        self.assertTrue(any('Git evidence mismatch' in problem for problem in self.specs(data=data,amendments=amendments)))

    def test_duplicate_amendment(self):
        evidence=copy.deepcopy(self.amendments);evidence['amendments'].append(copy.deepcopy(evidence['amendments'][0]))
        self.assertTrue(any('Duplicate' in problem for problem in self.specs(amendments=evidence)))

    def test_stale_amendment(self):
        evidence=copy.deepcopy(self.amendments);evidence['amendments'][0]['id']='DOC-99'
        self.assertTrue(any('stale' in problem for problem in self.specs(amendments=evidence)))

    def test_amendment_cannot_change_ids(self):
        evidence=copy.deepcopy(self.amendments);evidence['amendments'][0]['field']='id'
        self.assertTrue(any('Amendment schema' in problem for problem in self.specs(amendments=evidence)))

    def test_wrong_amendment_baseline(self):
        evidence=copy.deepcopy(self.amendments);evidence['baseline_sha']='0'*40
        self.assertTrue(any('Amendment schema' in problem for problem in self.specs(amendments=evidence)))

    def test_missing_git_evidence(self):
        def missing(commit):raise OSError('missing commit')
        self.assertTrue(any('Git evidence mismatch' in problem for problem in self.specs(loader=missing)))

    def test_full_audit(self):
        result=subprocess.run([sys.executable,str(ROOT/'planning/tools/check_tracker.py')],text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        report=json.loads(result.stdout);self.assertEqual(sum(report['execution_counts'].values()),83)

    def test_malformed_json(self):
        with tempfile.TemporaryDirectory() as directory:
            plan=Path(directory)/'planning';plan.mkdir();(plan/'tasks.json').write_text('{')
            result=subprocess.run([sys.executable,str(ROOT/'planning/tools/check_tracker.py'),'--repo',directory],text=True,capture_output=True)
            self.assertEqual(result.returncode,1);self.assertEqual(json.loads(result.stdout)['status'],'FAIL')

    def test_frozen_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            plan=Path(directory)/'planning';plan.mkdir()
            for name in ('tasks.json','task-schema.json','source-register.json','spec-amendments.json'):
                shutil.copyfile(ROOT/'planning'/name,plan/name)
            shutil.copytree(ROOT/'planning/import-baseline',plan/'import-baseline')
            target=plan/'import-baseline/tasks.json';target.write_bytes(target.read_bytes()+b'\n')
            result=subprocess.run([sys.executable,str(ROOT/'planning/tools/check_tracker.py'),'--repo',directory],text=True,capture_output=True)
            self.assertEqual(result.returncode,1);self.assertIn('baseline hash drift tasks.json',json.loads(result.stdout)['problems'])

    def test_frozen_formatter(self):
        cli=os.environ.get('NEXUS_BIOME_CLI',str(ROOT/'node_modules/@biomejs/biome/bin/biome'))
        paths=[str(ROOT/'planning/import-baseline'/name) for name in ('tasks.json','task-schema.json','source-register.json')]
        result=subprocess.run(['node',cli,'format','--no-errors-on-unmatched',*paths],cwd=ROOT,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

    def test_render_deterministic_and_check_read_only(self):
        with tempfile.TemporaryDirectory() as directory:
            command=[sys.executable,str(ROOT/'planning/tools/render_backlog.py'),'--output-dir',directory]
            subprocess.run(command,check=True,capture_output=True)
            files=sorted(Path(directory).glob('*.md'));before={p.name:p.read_bytes() for p in files};self.assertEqual(len(files),3)
            subprocess.run(command,check=True,capture_output=True);self.assertEqual(before,{p.name:p.read_bytes() for p in files})
            subprocess.run(command+['--check'],check=True,capture_output=True)
            target=Path(directory)/'ROADMAP.md';target.write_text('reviewed drift\n')
            result=subprocess.run(command+['--check'],capture_output=True,text=True)
            self.assertEqual(result.returncode,1);self.assertEqual(target.read_text(),'reviewed drift\n')

    def test_repository_views(self):
        result=subprocess.run([sys.executable,str(ROOT/'planning/tools/render_backlog.py'),'--check'],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)


if __name__=='__main__':unittest.main()
