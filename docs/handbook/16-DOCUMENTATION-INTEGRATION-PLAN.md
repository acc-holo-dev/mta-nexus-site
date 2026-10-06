# MTA NEXUS — план интеграции handbook в GitHub

> Статус: OPEN до ревью владельца.  
> Не выполнять автоматически: текущий `mta-nexus-site` намеренно ограничивает long-form documentation и имеет policy test на её состав.

## 1. Проблема

Этот review bundle специально подробный и состоит из многих `.md`, потому что его цель — восстановить весь продуктовый замысел и дать владельцу возможность исправить его до передачи следующему AI-агенту.

Текущий `mta-nexus-site`, наоборот, придерживается минималистичной repository policy:

```text
docs/ARCHITECTURE.md
docs/OPERATIONS.md
docs/PROBLEMS.md
```

Поэтому прямое копирование handbook в `docs/` создаст две проблемы:

1. может сломать policy test;
2. создаст дубли между technical handbook chapters и current canonical docs.

---

## 2. Рекомендуемая конечная модель

### Option A — layered docs (рекомендация)

```text
README.md

docs/
├─ ARCHITECTURE.md          # технический source of truth
├─ OPERATIONS.md            # operational source of truth
├─ PROBLEMS.md              # единственный текущий problem registry
└─ handbook/
   ├─ README.md
   ├─ PROJECT-CONCEPT.md
   ├─ ROLES-AND-PERMISSIONS.md
   ├─ FEATURES-AND-SURFACES.md
   ├─ TRUST-SAFETY-SECURITY.md
   ├─ UX-AND-DESIGN.md
   ├─ BUSINESS-MODEL.md
   ├─ DOMAIN-AND-DATA-MODEL.md
   ├─ ROADMAP.md
   ├─ AI-AGENT-HANDOFF.md
   ├─ DECISION-REGISTER.md
   └─ SOURCE-MAP.md
```

### Что не дублировать

Текущие `07-TECHNICAL-ARCHITECTURE.md` и `09-OPERATIONS-TESTING-RELEASE.md` после интеграции лучше превратить в короткие handbook-overviews со ссылками на canonical `ARCHITECTURE.md` и `OPERATIONS.md`, либо убрать как отдельные файлы.

Это оставит:

- подробное product knowledge в handbook;
- live technical truth в уже существующих docs;
- один problem registry;
- меньше риска documentation drift.

---

## 3. Option B — один большой HANDBOOK.md

```text
docs/
├─ ARCHITECTURE.md
├─ OPERATIONS.md
├─ PROBLEMS.md
└─ HANDBOOK.md
```

Плюсы:

- проще policy;
- легко дать AI одним файлом.

Минусы:

- очень большой файл;
- хуже review отдельных бизнес-решений;
- больше merge conflicts;
- сложнее ownership разделов.

Не является основной рекомендацией.

---

## 4. Option C — заменить текущую документацию handbook'ом

Не рекомендуется.

Причины:

- `ARCHITECTURE.md` и `OPERATIONS.md` уже содержат плотную executable-adjacent truth;
- handbook по природе содержит product decisions, OPEN-вопросы и legacy context;
- mixing them создаст большой документ, где агенту сложнее различать current runtime truth и vision.

---

## 5. Migration sequence после ревью владельца

### Step 1 — закрыть критические вопросы

Минимум:

- positioning;
- primary audience;
- paid marketplace yes/no;
- seller policy;
- commission/subscription direction;
- DRM direction;
- forum/community scope;
- AI autonomy.

### Step 2 — обновить draft

- Decision Register;
- Business Model;
- Roles;
- Roadmap;
- Project Concept.

### Step 3 — удалить review-only элементы

Например:

- вопросы, на которые уже ответили;
- повторяющиеся explanations;
- варианты, которые владелец rejected.

### Step 4 — выбрать docs layout

Рекомендуется Option A.

### Step 5 — обновить repository policy

Осознанно изменить:

- README documentation section;
- mainline repository policy test;
- любые scripts/checks, которые ожидают старый набор файлов.

### Step 6 — deduplicate

Не копировать operational details из current docs в handbook дословно.

### Step 7 — links check

Проверить:

- все relative links;
- anchors;
- source paths;
- read order.

### Step 8 — CI

Запустить минимум:

- policy tests;
- lint/format relevant to docs/test changes;
- full required CI если policy test/README affects acceptance rules.

### Step 9 — commit to main

Один coherent documentation migration commit или небольшая последовательность из:

1. policy/layout;
2. handbook content;
3. link/readme cleanup.

Не оставлять intermediate state, где README указывает на несуществующие docs.

---

## 6. Документационная иерархия после интеграции

Предлагаемый порядок истины:

```text
Code / migrations / tests
        ↓
ARCHITECTURE / OPERATIONS / PROBLEMS
        ↓
Handbook Decision Register
        ↓
Handbook product chapters
        ↓
Roadmap candidates
        ↓
Source Map / legacy references
```

---

## 7. Что дать AI-агенту

После интеграции AI не обязательно читать всё каждый раз.

### Новый агент / крупная задача

- `docs/handbook/README.md`;
- Decision Register;
- AI Handoff;
- current PROBLEMS;
- relevant canonical technical doc.

### Обычный bugfix

- current code/tests;
- PROBLEMS, если bug зарегистрирован;
- relevant ARCHITECTURE/OPERATIONS section.

### Business/product feature

- Project Concept;
- Roles;
- Business Model;
- Decision Register;
- Roadmap;
- relevant technical source.

---

## 8. Documentation freshness rule

Каждый durable документ должен отвечать на один вопрос.

Если одна и та же истина повторяется в двух местах:

- одно место становится canonical;
- второе ссылается на canonical и даёт только контекст.

Нельзя поддерживать две независимые копии одной security/operations specification.

---

## 9. Что НЕ коммитить в финальную версию без нужды

Review bundle может содержать больше пояснений, чем нужно репозиторию.

После утверждения можно убрать:

- полностью отвеченные interview questions;
- длинные legacy explanations, если они больше не влияют на решения;
- duplicated technical implementation details;
- snapshot facts, которые быстро стареют и уже есть в code/docs.

---

## 10. Definition of Done documentation migration

- владелец прочитал/исправил product model;
- OPEN critical decisions либо закрыты, либо явно оставлены OPEN;
- repository policy сознательно изменена;
- CI policy test соответствует новой структуре;
- canonical technical docs не дублируются;
- handbook легко читается человеком;
- AI source precedence очевиден;
- все links работают;
- `main` clean;
- exact commit содержит весь handoff context.
