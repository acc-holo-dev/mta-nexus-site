"""Validate the historical review package draft.

Does not run product code or assert live readiness.
In the repository layout this tool expects the original package tree
(`repository/planning`, `validation/`) — use the unzipped development package,
or validate the frozen `planning/import-baseline/` via `check_tracker.py`.
For the active JSON-in-repo tracker run: `python planning/tools/check_tracker.py`.
"""
import argparse
import collections
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote

ROOT=Path(__file__).resolve().parents[1]
PLAN=ROOT/'repository/planning'
if not (PLAN/'tasks.json').is_file():
    raise SystemExit(
        'check_package.py validates the historical review_draft package layout. '
        'From the repo use: python planning/tools/check_tracker.py'
    )

def read(name): return json.loads((PLAN/name).read_text())

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--repo',type=Path);args=ap.parse_args()
    problems=[];checks=[];warnings=[]
    def require(condition,msg):
        if not condition: problems.append(msg)
    data=read('tasks.json');tasks=data['tasks'];ids=[t['id'] for t in tasks];idset=set(ids)
    require(len(ids)==len(idset),'Duplicate task IDs')
    required=['id','title','track','phase','decision_status','queue_state','priority','source_ids','current','goal','scope_files','acceptance','verification','dependencies','dependency_notes','permission','evidence','limits','execution_state']
    enums={'phase':set('F'+str(x) for x in range(7)),
           'decision_status':{'existing_goal','accepted_direction','proposal','verification_required'},
           'queue_state':{'specified','needs_decision','external_gate','deferred'},'priority':{'P1','P2','P3'},
           'permission':{'local_development','github_settings','external_live','commercial_activation'},'execution_state':{'not_started'}}
    graph={t['id']:t['dependencies'] for t in tasks}
    all_source=collections.defaultdict(list);reference_count=0;repo_paths=set()
    for t in tasks:
        for k in required:require(k in t,f"{t['id']}: missing {k}")
        for k,values in enums.items(): require(t.get(k) in values,f"{t['id']}: invalid {k}")
        for k in ['acceptance','verification','source_ids','scope_files','evidence']:require(isinstance(t.get(k),list) and t[k],f"{t['id']}: empty {k}")
        require(re.fullmatch(r'(DOC|OPS|FLOW|UX|GROW)-\d{2}',t['id']) is not None,'Invalid task ID '+t['id'])
        for d in t['dependencies']: require(d in idset and d!=t['id'],f"{t['id']}: invalid dependency {d}")
        for d in t.get('conditional_dependencies',[]):require(d['id'] in idset and bool(d['when']),f"{t['id']}: invalid conditional dependency")
        for s in t['source_ids']:all_source[s].append(t['id'])
        require('new' not in t['source_ids'],f"{t['id']}: generic untraceable source ID")
        for e in t['evidence']:
            reference_count+=1
            require(bool(e.get('path')) and bool(e.get('lines')),f"{t['id']}: incomplete evidence")
            url=e.get('url','')
            official=e.get('source_type')=='official_web'
            if official:
                require(url.startswith('https://docs.github.com/') and bool(e.get('verified_as_of')),f"{t['id']}: unclassified external evidence {url}")
            else:
                require(data['baseline_sha'] in url,f"{t['id']}: evidence not pinned {url}")
            if args.repo and not official:
                path=args.repo/e['path'];repo_paths.add(e['path'])
                require(path.is_file(),f"{t['id']}: missing evidence file {e['path']}")
                if path.is_file():
                    total=len(path.read_text().splitlines())
                    nums=[int(x) for x in re.findall(r'\d+',str(e['lines']))]
                    require(nums and min(nums)>=1 and max(nums)<=total,f"{t['id']}: evidence range outside file {e['path']} {e['lines']}")
    visited=set();active=set()
    def visit(id):
        if id in active:problems.append('Dependency cycle at '+id);return
        if id in visited:return
        active.add(id)
        for d in graph.get(id,[]):
            if d in graph:visit(d)
        active.remove(id);visited.add(id)
    for id in ids:visit(id)
    checks.append('Task schema/enums, unique IDs and unconditional dependency DAG')
    source=read('source-register.json');baseids={s['id'] for s in source['sources']}
    require(len(baseids)==96,'Expected 96 unique original source IDs')
    for s in source['sources']:
        require(s['id'] in all_source,'Missing source coverage '+s['id'])
        require(set(s['task_ids'])==set(all_source[s['id']]),'Stale source map '+s['id'])
        for e in s['evidence']:
            if args.repo:
                path=args.repo/e['path'];repo_paths.add(e['path'])
                require(path.is_file(),'Missing source-register evidence '+e['path'])
    for n in range(1,11):require(f'F{n:02}' in all_source,f'Missing F{n:02}')
    checks.append('All 96 original points and F01–F10 mapped to tasks')
    ds=read('decision-baseline.json');dids=[d['id'] for d in ds['decisions']]
    require(len(dids)==len(set(dids)),'Duplicate baseline decision ID')
    if args.repo:
        p=args.repo/ds['source_path']
        require(hashlib.sha256(p.read_bytes()).hexdigest()==ds['source_sha256'],'Decision baseline source hash changed')
        source_lines=p.read_text().splitlines()
        for d in ds['decisions']:
            require(hashlib.sha256(source_lines[d['line']-1].encode()).hexdigest()==d['line_sha256'],'Decision line hash changed '+d['id'])
    checks.append('Baseline decision IDs/statuses indexed; source hashes checked when --repo supplied')
    inventory=read('documents-map.json')['documents'];docpaths=[d['path'] for d in inventory]
    require(len(docpaths)==58 and len(set(docpaths))==58,'Expected 58 unique document inventory entries')
    require(all(not d['may_delete_now'] and d['semantic_migration']=='not_performed' for d in inventory),'Inventory must not claim completed semantic migration')
    if args.repo:
        actual={'README.md','AGENTS.md'}|{p.relative_to(args.repo).as_posix() for p in (args.repo/'docs').rglob('*.md')}
        require(actual==set(docpaths),'Document inventory does not match repository')
        for d in inventory:require(hashlib.sha256((args.repo/d['path']).read_bytes()).hexdigest()==d['sha256'],'Document hash changed '+d['path'])
    checks.append('All 56 docs and two root files mapped without deletion authorization')
    for r in read('retention-directions.json')['directions']:
        for id in r['task_ids']:require(id in idset,'Retention direction references missing task '+id)
    for id in read('milestones.json')['recommended_first_wave']:require(id in idset,'First wave missing task '+id)
    local_links=0
    val=ROOT/'validation';val.mkdir(exist_ok=True)
    if not (val/'REPORT.md').exists():
        (val/'REPORT.md').write_text('# Проверка пакета\n\nПроверка выполняется; итог будет записан этим же запуском.\n')
    for path in ROOT.rglob('*.md'):
        text=path.read_text()
        # Markdown link destinations; current generated paths are percent-decoded only for local resolution.
        for href in re.findall(r'\]\(([^\s)]+)(?:\s+[^)]*)?\)',text):
            if re.match(r'(https?://|mailto:|#)',href):continue
            clean=unquote(href.split('#',1)[0])
            if not clean:continue
            local_links+=1;target=(path.parent/clean).resolve()
            require(target.exists(),f'Missing local link {path.relative_to(ROOT)} -> {href}')
    checks.append('Local Markdown link targets exist (external destinations and anchor semantics not revalidated)')
    require(data['package_status']=='review_draft','Package must remain review draft')
    require(all(t['execution_state']=='not_started' for t in tasks),'Package claims task execution')
    checks.append('Draft/execution boundaries retained; no product PASS inferred')
    report={'status':'PASS' if not problems else 'FAIL','baseline_sha':data['baseline_sha'],'as_of':data['as_of'],
      'checks':checks,'problems':problems,'warnings':warnings,
      'metrics':{'tasks':len(tasks),'source_points':len(baseids),'audit_findings':10,'decision_ids':len(dids),'source_documents':len(inventory),
                 'task_evidence_references':reference_count,'unique_repository_evidence_paths_checked':len(repo_paths),'local_link_targets_checked':local_links,
                 'phase_counts':dict(collections.Counter(t['phase'] for t in tasks)),
                 'queue_counts':dict(collections.Counter(t['queue_state'] for t in tasks)),
                 'decision_counts':dict(collections.Counter(t['decision_status'] for t in tasks))},
      'limits':['This validates a documentation package, not product correctness or live readiness.',
                'No runtime suites, build, deploy or production tests run in this iteration.',
                'Acyclic dependencies do not by themselves prove semantic sufficiency; root reviewed cross-track conditions.',
                'Complete semantic migration of the 52 handbook chapters is DOC-05, not performed by this index.',
                'External links are pinned/official references; this script does not perform network requests.']}
    (val/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    md='# Проверка пакета документации\n\n**Результат:** '+report['status']+'. **Срез:** `'+data['baseline_sha']+'`.\n\nЭто проверка структуры пакета, не новый PASS приложения или production.\n\n## Проверено\n\n'+ '\n'.join('- '+x for x in checks)+'\n\n## Метрики охвата\n\n| Поле | Значение |\n|---|---|\n'
    for k,v in report['metrics'].items():md+='| '+k+' | '+str(v)+' |\n'
    md+='\n## Ограничения\n\n'+'\n'.join('- '+x for x in report['limits'])+'\n'
    if problems:md+='\n## Ошибки\n\n'+'\n'.join('- '+x for x in problems)+'\n'
    (val/'REPORT.md').write_text(md)
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return 1 if problems else 0

if __name__=='__main__': raise SystemExit(main())
