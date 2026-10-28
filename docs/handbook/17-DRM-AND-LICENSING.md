# 17. DRM и лицензирование

> Статус: target architecture v0.3. Owner decisions confirmed; cryptographic/API details require threat-model review.

## 1. Product rule

NEXUS обязан иметь полноценную DRM/licensing capability. **Seller сам решает, подключать ли DRM к конкретному коммерческому ресурсу.**

## 2. Lifecycle

Confirmed: `Purchase → License → Installation/Server → Activation → Lease`. Purchase, payment и license не схлопываются в один flag.

## 3. Universal runtime/module

OWNER DECISION: один compiled runtime/module должен использоваться на множестве серверов. Никакой отдельной компиляции под каждого покупателя/сервер. Индивидуализация идёт через license ID, server/installation binding, signed activation/lease, entitlements, keys/config и revocation state.

## 4. Seller flow

1. Seller создаёт paid resource.
2. Включает `DRM protected`, если хочет.
3. Подключает документированный NEXUS SDK/adapter contract.
4. NEXUS выдаёт product integration identity/keys.
5. Buyer после успешной покупки получает License.
6. Installation активируется для server.
7. Universal runtime проверяет lease локально/через bounded online refresh.
8. Revocation/update работают без customer-specific rebuild.

## 5. Offline behavior

Confirmed grace = **7 days** при временной недоступности NEXUS/network. **DECISION:** после grace защищённый ресурс должен перейти в hard stop и не продолжать полную работу без валидного lease.

## 6. Security goals

DRM должен усложнять массовое копирование, подтверждать право использования, поддерживать revocation, controlled transfers, updates и audit. Он не обещает абсолютную невозможность reverse engineering.

## 7. Cryptographic direction

Legacy Ed25519/AES-GCM идеи — reference only. Target design должен пройти новый threat model. Private signing keys никогда не поставляются в module; runtime использует public verification material/rotatable trust anchors. Activation idempotent/rate-limited; key rotation и downgrade handling first-class.

## 8. Privacy

Telemetry минимальная. **DECISION:** базово допустимы license ID, server/installation ID, resource/version и timestamp/heartbeat; technical connection address/IP — только когда реально требуется для security/operation. Hardware fingerprint не используется без отдельной доказанной необходимости. Не собирать данные «на всякий случай».

## 9. Transfers

**DECISION:** базовая UX-политика — один бесплатный перенос лицензии на другой server/installation примерно каждые 30 дней; более частый или нестандартный перенос идёт через support/review. Точная anti-abuse автоматика может быть уточнена по threat model.

## 10. Forensics

Подтверждён seller-opt-in watermark/fingerprinting с индивидуальными маркерами без перекомпиляции универсального runtime (DRM-014/015). Маркер — evidence для staff-расследования, а не автоматический обвинительный вердикт. Минимизация telemetry и защита приватных сигналов обязательны.

## 11. Buyer trust

До покупки UI показывает: используется ли DRM, binding model, 7-day grace, transfer limits, required runtime, refund/dispute consequences и telemetry.


## 12. Hard-stop requirements

Hard stop after grace must fail predictably and explainably. Runtime should expose a clear local error/status for owner/admin logs rather than silently corrupting application state. Recovery after obtaining a valid lease must not require customer-specific recompilation.

## 13. Source-code products

DRM is optional per product/SKU. A seller may sell:

- closed-source protected build;
- closed-source unprotected build;
- source-code license;
- combinations/tiers where source access is a separately priced entitlement.

The product page must state what is delivered and whether DRM applies to each SKU/tier.

## 16. product-delivery rule

Для marketplace формализованы два базовых delivery mode:

1. **Closed code** — seller может включить DRM или оставить closed delivery без DRM.
2. **Open source** — DRM не применяется, потому что исходный код передаётся покупателю/пользователю.

Source code может выступать отдельной premium license/variant. При этом честный UI обязан явно показывать, что именно покупатель получает: executable/compiled artifact, исходники, license scope и наличие/отсутствие DRM.

Покупка по умолчанию включает будущие версии продукта. DRM/license state должен переживать обычные updates без ручной re-issue license, если seller не изменил compatible licensing policy.

## 17. delist retention and paid term

The 30-day post-delist/post-seller-ban window governs **NEXUS hosting/redownload availability**, not an automatic DRM kill switch.

OWNER DECISION: an already activated DRM license continues to work until the end of its **contractual paid term**.

- fixed-term license: until its normal expiry;
- subscription-bound license: until paid entitlement expiry;
- perpetual SKU: delist alone does not invent a new expiry;
- malware/legal/security revocation may override normal commercial expiry;
- after the 7-day offline grace, runtime still hard-stops whenever a required lease is invalid/expired.

Do not conflate download retention, seller status, license expiry and security revocation into one boolean.


## license lifetime and forensic protection

- A seller may offer **perpetual** or **time-limited/subscription** licenses.
- For a perpetual DRM-protected resource, successful activation grants indefinite product-use rights unless a formal revoke, malware, legal or security action applies.
- The existing **7-day grace period** is only offline lease tolerance. It does not convert a perpetual license into a seven-day license.
- Forensic watermark/fingerprinting is seller-opt-in. NEXUS may generate customer/license-specific package metadata or markers while keeping the universal DRM runtime unchanged.
- A leaked marker is only evidence. One match cannot automatically ban or label a user SCAM.
- Sellers see leak suspicion/case status but not raw anti-abuse signals or detection algorithms.
- Seller-initiated revoke requires a structured allowed reason such as refund, confirmed fraud or contractual violation and produces audit/case evidence.