"""Render read-only Markdown views of the canonical task specifications."""
from __future__ import annotations

import collections
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "planning"
DOCS = ROOT / "docs"


def read(name: str):
    return json.loads((PLAN / name).read_text(encoding="utf8"))


def write(name: str, text: str) -> None:
    (DOCS / name).write_text(text.rstrip() + "\n", encoding="utf8")


def cell(s) -> str:
    return str(s).replace("|", "\\|").replace("\n", " ")


def bullets(values) -> str:
    return "\n".join("- " + str(x) for x in values)


def main() -> None:
    data = read("tasks.json")
    tasks = data["tasks"]
    byid = {t["id"]: t for t in tasks}
    ms = read("milestones.json")
    sources = read("source-register.json")["sources"]
    phases = {x["id"]: x for x in ms["phases"]}
    queues = {
        "specified": "Спецификация готова",
        "needs_decision": "Нужен продуктовый выбор",
        "external_gate": "Приёмка внешней среды",
        "deferred": "Отложено",
    }
    decisions = {
        "existing_goal": "Существующая цель",
        "accepted_direction": "Принятое направление",
        "proposal": "Предложение",
        "verification_required": "Сначала проверка факта",
    }
    exec_labels = {
        "not_started": "Не начато",
        "in_progress": "В работе",
        "blocked": "Блок",
        "done": "Сделано",
        "cancelled": "Отменено",
    }
    counts = collections.Counter(t["phase"] for t in tasks)
    exec_counts = collections.Counter(t["execution_state"] for t in tasks)
    tracker = data.get("tracker") or {}
    head = f"""# Roadmap MTA NEXUS — рабочая редакция v1

Сформирован из `planning/tasks.json`; вручную это представление не редактируется. База `{data['baseline_sha']}`, дата {data['as_of']}.

**Рабочий tracker (DOC-03):** `{tracker.get('mode', 'unknown')}`. Живой статус исполнения — только в `planning/tasks.json`. Замороженный import baseline: `{tracker.get('import_baseline', 'planning/import-baseline/')}`. GitHub Issues: `{(tracker.get('issues_import') or {}).get('status', 'unknown')}` (нужен `github_settings`). Контракт: [TRACKER.md](../planning/TRACKER.md).

Счётчики исполнения: {", ".join(f"{k}={v}" for k, v in sorted(exec_counts.items()))}. Подготовленная карточка не является автоматическим поручением.

## Принцип приоритета

Ближайшая цель — законченные пути бесплатной beta и доказуемая эксплуатационная готовность. Все 96 исходных пунктов сохранены, но не все являются launch blockers. Сначала конкретные дефекты и проверки риска; новые поверхности и пилоты идут по принятому scope. Фазы помогают ориентироваться, явные dependencies определяют фактический порядок.

P1/P2/P3 — относительный приоритет внутри указанного контекста, а не оценка срока или тяжести инцидента. `release_conditions` задаёт конкретное условие применимости: например, ARC14 нужен перед изменением схемы, F03/F04 — для целевой live-среды, F02 — перед следующим приёмочным кандидатом.

## Этапы

| Фаза | Цель | Задач | Условие завершения |
|---|---|---:|---|
"""
    for p in ms["phases"]:
        head += f"| {p['id']} — {p['name']} | {cell(p['outcome'])} | {counts[p['id']]} | {cell(p['exit'])} |\n"
    head += """
F6 намеренно не содержит детального execution backlog: коммерческий блок обсуждается отдельно, действующие owner targets сохраняются. Conditional object storage относится к инфраструктуре F3 и остаётся deferred; для бесплатной beta оно не обязательно по умолчанию.

## Первая рекомендуемая волна

Это короткая очередь для выбора конкретного поручения. Она не означает, что все строки выполняются последовательно или что нужно сначала переписать весь handbook.

| ID | Результат | Исполнение | Зависимости / оговорка |
|---|---|---|---|
"""
    for id in ms["recommended_first_wave"]:
        t = byid[id]
        note = ", ".join(t["dependencies"]) or "Независимая подготовка в порученной области"
        if t.get("conditional_dependencies"):
            note += "; OPS-06 только при новом SQL"
        head += f"| {id} | {cell(t['title'])} | {exec_labels.get(t['execution_state'], t['execution_state'])} | {cell(note)} |\n"
    head += """
После этой волны OPS-02/03/05/08/10 готовят воспроизводимую доставку, UX/FLOW задачи доводят выбранные core journeys, OPS-13/14 подтверждают реальную готовность среды. OPS-16/17 требуют отдельного внешнего действия. Общие UI primitives и архитектурная уборка не блокируют независимое исправление маленького существующего дефекта.

## Как читать состояния

- `specified`: карточка достаточно конкретна; исполнение ещё не начиналось (см. `execution_state`).
- `needs_decision`: есть новый продуктовый выбор; можно готовить вариант и продолжать независимую работу.
- `external_gate`: нужна проверяемая внешняя среда, оператор или соответствующее поручение.
- `deferred`: исключено из автоматической ближайшей очереди.
- `execution_state`: факт работы (`not_started` / `in_progress` / `blocked` / `done` / `cancelled`) — только в JSON-tracker.

Решение, спецификация, разрешённая работа, выполненная реализация, проверка и live-включение — разные факты. Не ведите второй backlog вручную.

## Полный индекс

Приёмка, реальные paths, проверки и источники — в [TASKS.md](TASKS.md). Связи исходного анализа — в [TRACEABILITY.md](TRACEABILITY.md).

"""
    for phase in phases:
        subset = [t for t in tasks if t["phase"] == phase]
        if not subset:
            continue
        head += f"### {phase} — {phases[phase]['name']}\n\n| ID | Задача | P | Решение | Очередь | Исполнение |\n|---|---|---|---|---|---|\n"
        for t in subset:
            head += (
                f"| {t['id']} | {cell(t['title'])} | {t['priority']} | "
                f"{decisions[t['decision_status']]} | {queues[t['queue_state']]} | "
                f"{exec_labels.get(t['execution_state'], t['execution_state'])} |\n"
            )
        head += "\n"
    head += """## Оценка сроков и успеха

Сроки нельзя честно получить из количества карточек. В начале фиксируются состав команды, доступная ёмкость и готовность среды. После первых законченных изменений оценивают объём следующих задач диапазонами и учитывают review, integrated tests и операционную приёмку. Пилоты retention получают отдельный budget/владельца и критерий остановки; число созданных функций не доказывает их эффективность.
"""
    write("ROADMAP.md", head)

    cards = """# Карточки задач MTA NEXUS

Сгенерировано из `planning/tasks.json`. Команды проверок в карточках — план проверки, а не выполненный PASS, пока `execution_state` не `done` и нет свидетельств. Читайте только выбранную задачу и её зависимости. Источники закреплены на baseline SHA. Рабочий tracker: [TRACKER.md](../planning/TRACKER.md).

"""
    for t in tasks:
        cards += f"## {t['id']} — {t['title']}\n\n"
        cards += (
            f"**Фаза:** {t['phase']}. **Приоритет:** {t['priority']}. "
            f"**Решение:** {t['decision_status']}. **Очередь:** {t['queue_state']}. "
            f"**Исполнение:** {t['execution_state']}. **Область полномочий:** {t['permission']}.\n\n"
        )
        if t.get("execution_notes"):
            cards += f"**Заметка исполнения.** {t['execution_notes']}\n\n"
        cards += (
            "**Исходные пункты:** "
            + ", ".join(t["source_ids"])
            + ". **Решения обсуждения:** "
            + ", ".join(t["decision_refs"])
            + ".\n\n"
        )
        cards += "**Сейчас.** " + t["current"] + "\n\n**Результат.** " + t["goal"] + "\n\n"
        cards += "### Область изменений\n\n" + bullets("`" + p + "`" for p in t["scope_files"]) + "\n\n"
        cards += "### Приёмка\n\n" + bullets(t["acceptance"]) + "\n\n"
        cards += "### Проверки при реализации\n\n" + bullets(t["verification"]) + "\n\n"
        cards += (
            "### Зависимости и условия\n\n"
            + (", ".join(t["dependencies"]) or "Без обязательных task dependencies.")
            + "\n\n"
            + t["dependency_notes"]
            + "\n\n"
        )
        for cond in t.get("conditional_dependencies", []):
            cards += f"- Условно {cond['id']}: {cond['when']}\n"
        if t.get("conditional_dependencies"):
            cards += "\n"
        cards += "Release applicability: " + ", ".join(t["release_conditions"]) + ".\n\n"
        cards += "### Источники\n\n"
        for e in t["evidence"]:
            label = e["path"].replace("[", "\\[").replace("]", "\\]") + " · " + str(e["lines"])
            cards += "- [" + label + "](" + e.get("url", e["path"]) + ")\n"
        cards += "\n### Ограничения\n\n" + bullets(t["limits"]) + "\n\n"
    write("TASKS.md", cards)

    trace = """# Прослеживаемость исходных рекомендаций

Сгенерировано из `planning/source-register.json` и `planning/tasks.json`. Каждый из 96 пунктов имеет хотя бы одну task-связь. Пункт может затрагивать несколько задач, а задача — объединять связанные наблюдения; эти числа не равны числу багов. Покрытие означает наличие места в плане, а не выполненную реализацию.

| ID | Исходный пункт | Задачи |
|---|---|---|
"""
    for s in sources:
        trace += f"| {s['id']} | {cell(s['item'])} | {', '.join(s['task_ids'])} |\n"
    trace += "\n## F01–F10 и дополнительные источники\n\n| Источник | Задачи |\n|---|---|\n"
    covered = collections.defaultdict(list)
    for t in tasks:
        for src in t["source_ids"]:
            covered[src].append(t["id"])
    for src in read("source-register.json")["additional_source_ids"]:
        trace += f"| {src} | {', '.join(covered[src])} |\n"
    trace += (
        "\nИсточники с префиксом DOC обозначают задачи управления документацией; RET — предложения "
        "измерений/пилотов; OPSNEW — новые части поставки. Это не новые подтверждённые дефекты. "
        "18 направлений старого MTA Market и дополнительные будущие идеи учтены отдельно в "
        "`planning/retention-directions.json`.\n"
    )
    write("TRACEABILITY.md", trace)
    print(
        json.dumps(
            {
                "rendered": ["ROADMAP.md", "TASKS.md", "TRACEABILITY.md"],
                "tasks": len(tasks),
                "source_rows": len(sources),
                "execution_counts": dict(exec_counts),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
