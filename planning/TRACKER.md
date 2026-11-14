# Рабочий tracker задач

Единственный источник спецификаций и исполнения — [tasks.json](tasks.json).
Он использует `layers.live.tasks` и `layers.history.tasks`. Поле `count` каждого
слоя равно числу его записей. Live — рабочая очередь: недавно завершённая карточка
может оставаться там; история содержит завершённые карточки. Перекладывание задач
между слоями не входит в исправление схемы.

На базе `7f6773b3cd88df2d9ecb963cbd46cce97a87c1d9`: 19 live + 64 history = 83 ID;
65 done и 18 not_started. Статусы не менялись этим рефакторингом. `ticket_status`
и `execution_state` — разные поля: первое не подменяет приёмку исполнения.

[ROADMAP](../docs/ROADMAP.md), [TASKS](../docs/TASKS.md) и
[TRACEABILITY](../docs/TRACEABILITY.md) — производные представления. Исторический
`baseline_sha` `385e577e7443cf7d7b817419ce5c3b8afe87b690` не заменяется текущим HEAD.
`import-baseline/` остаётся frozen источником будущего импорта; GitHub Issues не
создавались. Их импорт по-прежнему требует отдельного поручения `github_settings`.

## Воспроизводимые проверки

Python 3.12 и dev-only `jsonschema` из `tools/requirements.txt`; formatter — точная
версия Biome из root package.json. В обычном checkout используется workspace CLI,
в CI допустима изолированная установка через `NEXUS_BIOME_CLI`/`--biome-cli`.

```bash
python -m pip install -r planning/tools/requirements.txt
python planning/tools/check_tracker.py
python planning/tools/test_tracker.py
python planning/tools/render_backlog.py --output-dir /tmp/nexus-backlog-review
python planning/tools/render_backlog.py --check
```

`--contract-only` у checker проверяет schema, counts, уникальность ID и полный DAG
обязательных/условных dependencies; не заменяет исторический аудит default команды.
`--check` у renderer не записывает файлы и возвращает exit 1 при drift. Обычная
генерация разрешена после review временного diff. Все view форматируются до записи;
каждый файл публикуется через atomic rename. Это не общая filesystem транзакция
трёх файлов: после ошибки повторить генерацию и check.

Генератор был удалён на main, несмотря на действующий контракт производных views.
Он восстановлен для layered JSON. Просмотренный diff сохранил все 83 карточки,
источники и historical SHA-ссылки, исправил stale статусы/формулировки из JSON и
счётчики (раньше ROADMAP показывал 64/19). TRACEABILITY воспроизведён без изменений.
Тематическая организация live из шести направлений сохранена.

## Исторический аудит

Три frozen JSON восстановлены побайтно из
`3b9fafe183fabad6504b3e5524a35c0c5ca56443`: размеры и SHA-256 совпадают с исходным
MANIFEST. Перед восстановлением проверено семантическое равенство JSON. Изменение
`b70f6dea4826905ab66ef34cb708606fc779fb08` было форматированием. MANIFEST не пересчитан.
Только форматирование этих трёх файлов отключено в Biome; lint и byte audit сохранены.

[spec-amendments.json](spec-amendments.json) хранит проверяемые изменения
спецификаций между frozen и действующим main: ID/поле, old/new digest и принятый
Git commit с тем же значением. Это evidence registry без execution state, не
второй backlog. Digest — SHA-256 UTF-8 JSON (`ensure_ascii=False`, `sort_keys=True`,
`separators=(",", ":")`). Проверка требует ancestor commit и точное совпадение
поля в его `planning/tasks.json` (поддерживаются исторический root и новые layers).
Неучтённое отличие, подмена digest без Git proof, duplicate/stale запись и
недоступный commit дают FAIL. ID и baseline менять через amendments нельзя.

Статусные поля могут эволюционировать в живом JSON по принятому контракту. Для
спецификаций ledger фиксирует уже принятые значения main; новые незакоммиченные
отличия автоматически не принимаются. Добавление новых ID требует отдельного
расширения schema/source coverage, не переписывания frozen ID.

CI `plan` запускает полный audit, негативные tests и renderer check до выбора
scope, включая docs-only изменения. `fetch-depth: 0` нужен для Git evidence.
Указания исполнителю — в [AGENT](../docs/AGENT.md), миграция — в
[техническом плане](../docs/STRUCTURE-REFACTORING.md).
