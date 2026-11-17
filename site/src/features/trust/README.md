# Trust: публичные поверхности доверия

Прозрачность для людей: публичная сводка доверия пользователя, история одобрений
контекста (организация или сервер). Сервисы, контракты и маршруты App Router
остаются в прежних слоях; feature владеет композицией UI.

| Entry                          | Контракт                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `public-user-trust.ts`         | `PublicUserTrustPanel`; публичная страница `/users/:username/trust`                                     |
| `public-context-trust-page.ts` | `PublicContextTrustPage`, `contextTrustMetadata`; `/organizations/:slug/trust` и `/servers/:slug/trust` |
| `public-user-trust-copy.ts` | util port `public-user-trust-copy` |

Внутренние `components/` и `server/` не являются публичным API. Границы — dependency-cruiser и `scripts/tests/trust-feature-boundaries.node-test.mjs`.
