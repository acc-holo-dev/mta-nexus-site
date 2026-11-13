# Рабочий tracker задач

**Выбор DOC-03 (1 ноября 2026):** единственный рабочий источник статуса — **JSON-in-repo**.

| Роль                                   | Путь                                                                                                                            | Правило                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Живые спецификации + статус исполнения | [`planning/tasks.json`](tasks.json)                                                                                             | Редактировать здесь; один источник                                                   |
| Производные представления              | [`docs/ROADMAP.md`](../docs/ROADMAP.md), [`docs/TASKS.md`](../docs/TASKS.md), [`docs/TRACEABILITY.md`](../docs/TRACEABILITY.md) | Только через `python planning/tools/render_backlog.py`                               |
| Замороженный import baseline           | [`planning/import-baseline/`](import-baseline/)                                                                                 | Не менять ради live-статуса; нужен для будущего одноразового импорта в GitHub Issues |
| Исторический валидатор пакета          | `planning/tools/check_package.py` + `import-baseline/`                                                                          | Проверяет review_draft; не доказательство Done приложения                            |
| Валидатор рабочего tracker             | `planning/tools/check_tracker.py`                                                                                               | Уникальность ID, зависимости, schema, согласованность baseline                       |

## Переходный момент

1. До DOC-03 `planning/tasks.json` был review draft пакета (`execution_state=not_started` у всех 83 задач).
2. DOC-03 скопировал этот снимок в `planning/import-baseline/` и активировал JSON-in-repo.
3. Статусы DOC-01/DOC-02/DOC-03 ведутся только в живом `planning/tasks.json`.
4. **GitHub Issues не созданы.** Импорт потребует отдельного поручения с `permission=github_settings`. После импорта Issues станет рабочим источником, JSON в `import-baseline/` останется baseline, ROADMAP будет хранить ссылки; второй статус вручную не обновляется.

## Как отмечать выполнение

Допустимые `execution_state`: `not_started` · `in_progress` · `blocked` · `done` · `cancelled`.

`specified` / `needs_decision` / `queue_state` описывают готовность спецификации, а не факт выполнения. `done` ставится после приёмки карточки и достаточных проверок на конкретном SHA.

## Проверка live-контракта и производных документов

Python checker исполняет Draft 2020-12 JSON Schema из `planning/task-schema.json`.
Dev-only зависимость: `python -m pip install -r planning/tools/requirements.txt`
(рекомендуется отдельный venv).

```bash
python planning/tools/check_tracker.py --contract-only
python planning/tools/check_tracker.py
python planning/tools/test_tracker.py
python planning/tools/render_backlog.py --output-dir /tmp/nexus-backlog-review
python planning/tools/render_backlog.py --check
```

`--contract-only` проверяет live schema, уникальность ID и зависимости, включая
условные; не заменяет полный historical audit. Для полного аудита нужен Git checkout
с историей коммитов (CI использует `fetch-depth: 0`).

`render_backlog.py` использует точную версию Biome из root package.json, форматирует
текст через stdin и побайтно воспроизводит три документа. По умолчанию CLI берётся
из workspace node_modules; изолированную установку можно передать через
`--biome-cli /path/to/biome` или `NEXUS_BIOME_CLI`. Неправильная версия/ошибка formatter
останавливает генерацию. Все три view сначала готовятся в памяти; только затем
файлы публикуются через отдельные atomic rename. Общей транзакции трёх файлов нет:
при filesystem failure следует повторить генерацию и `--check`.

`--check` ничего не записывает и возвращает exit 1 при drift. Перед обычной
перегенерацией просмотреть diff во временном каталоге. Генератор не читает
текущие docs как шаблон и не ведёт независимые статусы.

## Frozen baseline и изменения спецификаций

`planning/import-baseline/MANIFEST.json` продолжает проверять исходные размеры и
SHA-256 всех трёх frozen JSON. Восстановлены точные байты из коммита
`3b9fafe183fabad6504b3e5524a35c0c5ca56443`, совпадающие с manifest; JSON-содержание
до/после восстановления одинаково. Причина дрейфа — форматирование в
`b70f6dea4826905ab66ef34cb708606fc779fb08`. Три frozen JSON исключены только из форматирования Biome,
поскольку его контракт — побайтная историческая неизменность, проверяемая checker.
Manifest не пересчитан; `baseline_sha` остался прежним.

[`spec-amendments.json`](spec-amendments.json) — свидетельства четырёх уже принятых
изменений полей, не tracker. В нём нет статусов исполнения. Для каждой пары
ID/поле указаны digest исходного/живого значения, Git commit и причина.
Digest: SHA-256 UTF-8 JSON с `ensure_ascii=False`, `sort_keys=True`,
`separators=(",", ":")`. Checker сверяет оба digest и значение поля в указанном
коммите, который обязан быть предком HEAD. Новые отличия, неизвестные/повторные,
устаревшие записи и недоступные доказательства дают FAIL. Сейчас разрешены только
поля `verification` и `scope_files`; прочие specification fields сохраняют
первоначальную проверку относительно frozen baseline.

| Карточка / поле               | Коммит, содержащий изменение               |
| ----------------------------- | ------------------------------------------ |
| OPS-13, OPS-14 / verification | `45d59aff2b473f41b576d638b1ee94f8efa260db` |
| UX-06 / scope_files           | `bb64d7cdcd9da8c636bf842264f2a968d9d49872` |
| GROW-08 / scope_files         | `e5610f4aa91e685090785aacd119f7e66f17a6d4` |

Изменение spec требует одновременно нового reviewable свидетельства; правка ledger
сама по себе не объявляет задачу done. Новые task ID по-прежнему требуют отдельного
расширения schema и baseline/source coverage policy. Рабочие tasks, их статусы,
исторические ссылки и source register при этом исправлении не менялись.

Основной CI `plan` теперь устанавливает Python requirements и изолированный Biome
той же версии из root package.json (без workspace install), запускает полный
checker, отрицательные тесты и renderer `--check` до определения scope. Эта проверка
выполняется и для docs-only изменений. Прежние code/full acceptance gates сохранены.
Локальный результат не означает выполненный GitHub CI; результаты и ограничения
среды — в [техническом плане](../docs/STRUCTURE-REFACTORING.md#13-продолжение-восстановление-planning-audit-и-renderer).
