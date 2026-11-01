# Рабочий tracker задач

**Выбор DOC-03 (1 ноября 2026):** единственный рабочий источник статуса — **JSON-in-repo**.

| Роль | Путь | Правило |
|---|---|---|
| Живые спецификации + статус исполнения | [`planning/tasks.json`](tasks.json) | Редактировать здесь; один источник |
| Производные представления | [`docs/ROADMAP.md`](../docs/ROADMAP.md), [`docs/TASKS.md`](../docs/TASKS.md), [`docs/TRACEABILITY.md`](../docs/TRACEABILITY.md) | Только через `python planning/tools/render_backlog.py` |
| Замороженный import baseline | [`planning/import-baseline/`](import-baseline/) | Не менять ради live-статуса; нужен для будущего одноразового импорта в GitHub Issues |
| Исторический валидатор пакета | `planning/tools/check_package.py` + `import-baseline/` | Проверяет review_draft; не доказательство Done приложения |
| Валидатор рабочего tracker | `planning/tools/check_tracker.py` | Уникальность ID, зависимости, schema, согласованность baseline |

## Переходный момент

1. До DOC-03 `planning/tasks.json` был review draft пакета (`execution_state=not_started` у всех 83 задач).
2. DOC-03 скопировал этот снимок в `planning/import-baseline/` и активировал JSON-in-repo.
3. Статусы DOC-01/DOC-02/DOC-03 ведутся только в живом `planning/tasks.json`.
4. **GitHub Issues не созданы.** Импорт потребует отдельного поручения с `permission=github_settings`. После импорта Issues станет рабочим источником, JSON в `import-baseline/` останется baseline, ROADMAP будет хранить ссылки; второй статус вручную не обновляется.

## Как отмечать выполнение

Допустимые `execution_state`: `not_started` · `in_progress` · `blocked` · `done` · `cancelled`.

`specified` / `needs_decision` / `queue_state` описывают готовность спецификации, а не факт выполнения. `done` ставится после приёмки карточки и достаточных проверок на конкретном SHA.
