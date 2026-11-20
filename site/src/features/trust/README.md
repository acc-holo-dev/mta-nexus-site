# Trust: публичные поверхности доверия

Прозрачность для людей: публичная сводка доверия пользователя, история одобрений
контекста (организация или сервер). Сервисы, контракты и маршруты App Router
остаются в прежних слоях; feature владеет композицией UI.

| Entry                                     | Контракт                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `public-user-trust.ts`                    | `PublicUserTrustPanel`; публичная страница `/users/:username/trust`                                     |
| `public-context-trust-page.ts`            | `PublicContextTrustPage`, `contextTrustMetadata`; `/organizations/:slug/trust` и `/servers/:slug/trust` |
| `public-user-trust-copy.ts`               | util port `public-user-trust-copy`                                                                      |
| `public-verification-history-copy.ts`     | util port `public-verification-history-copy`                                                            |
| `public-context-trust-copy.ts`            | util port `public-context-trust-copy`                                                                   |
| `verification-workspace-copy.ts`          | util port `verification-workspace-copy`                                                                 |
| `public-context-trust-contract.ts`        | util port `public-context-trust-contract`                                                               |
| `public-user-trust-contract.ts`           | util port `public-user-trust-contract`                                                                  |
| `verification-applications-contract.ts`   | util port `verification-applications-contract`                                                          |
| `public-verification-history-contract.ts` | util port `public-verification-history-contract`                                                        |
| `verification-workspace-contract.ts`      | util port `verification-workspace-contract`                                                             |
| `verification-workspace-api.ts`           | util port `verification-workspace-api`                                                                  |
| `verification-api-copy.ts`                | util port `verification-api-copy`                                                                       |

Внутренние `components/` и `server/` не являются публичным API. Границы — dependency-cruiser и `scripts/tests/trust-feature-boundaries.node-test.mjs`.
