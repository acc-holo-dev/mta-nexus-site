# Design direction — free beta shell 2027

**measured_at:** 18 ноября 2026 (Europe/Moscow).  
**Baseline artifacts:** `/opt/cursor/artifacts/baseline-home-desktop.png`, `baseline-catalog-desktop.png`, `baseline-home-mobile.png`.  
**Related:** [`code-topology.md`](code-topology.md), [`UX-CONTRACT.md`](../UX-CONTRACT.md), `@nexus/ui`, `site/src/app/globals.css`.

## Product look (not another SaaS template)

MTA NEXUS is a **community platform for Multi Theft Auto**: servers, resources, authors, trust. The first viewport must read as that product — brand-first, atmospheric, expressive type — not a generic dashboard after removing the nav.

### Do

- Brand signal at hero level (`MTA NEXUS` / NX mark); one headline, one supporting line, one CTA group.
- Full-bleed hero atmosphere (gradient plane), not inset cards in the first viewport.
- Tokens in `--nexus-*` + semantic utilities; primitives in `@nexus/ui`.
- Motion for hierarchy (`Rise`, hero glow), with `prefers-reduced-motion` respected.
- RU+EN with fonts that cover Cyrillic (display **Unbounded**, body **Source Sans 3**).

### Don’t

- Purple-on-white / purple-indigo “AI gradient” themes as the brand (status purple token may exist for rare badges only).
- Inter / Roboto / Arial / bare system stacks as the designed face.
- Hero cards, floating promo chips, stat strips in the first viewport.
- Forking shell styles per page — use `BrandMark`, tokens, shared motion.

## Token foundation

| Layer                             | Source                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| Surfaces / text / accent / status | `:root` + `.dark` in `globals.css`                                                  |
| Type families                     | `--font-nexus-display`, `--font-nexus-sans` (next/font → CSS vars)                  |
| Motion                            | `--nexus-ease-out`, `--nexus-duration*`; keyframes `nexus-rise`, `nexus-glow-pulse` |
| Atmosphere                        | `.nexus-hero-atmosphere`                                                            |

Contrast gate: `site/tests/unit/design-token-contrast.test.ts`. Keep accent blue (#2456d9 light / #2f6fe0 dark) — distinct from purple status.

## Primitives added this slice

| Primitive   | Role                                         |
| ----------- | -------------------------------------------- |
| `BrandMark` | NX tile + wordmark for navbar/footer shell   |
| `Rise`      | Staggered presence motion for hero hierarchy |

Shell chrome lives in `features/shell` (Slices 4/6/7). Topology / Shell 2027 honesty polish through Wave 62 is complete on tip; Wave 63–65 localize discovery search payload + `/api/search` error envelope via `nexus_locale`. Continue API-envelope tips or F/ops external gates — not another chrome absorb.

## Proof bar

- Focused unit + format/lint on touched UI.
- computerUse before/after Home (desktop + mobile) under `/opt/cursor/artifacts/`.
- Do not claim beta live from green CI.
