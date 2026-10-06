# Revision v0.10

Date: 2026-10-06

## Scope

Round 9 closes the remaining major product-policy gaps around plan economics, public trust history, content moderation, commercial license lifetime, DRM forensics, support timing and production artifact infrastructure.

## Added

- `52-PLAN-ECONOMICS-COMMISSION-AND-HOLDS.md`
- `53-TRUST-PUBLIC-HISTORY-AND-CONTENT-MODERATION.md`
- `54-LICENSE-MODELS-FORENSICS-AND-REVOCATION.md`
- `55-PRODUCTION-STORAGE-SCANNERS-AND-OBSERVABILITY.md`
- `56-SUPPORT-SLA-AND-DISPUTE-TIMING.md`

## Owner decisions captured

- 10% remains current baseline commission; paid Creator plans may reduce it later.
- New-seller payout hold starts at 7 days and may improve through subscription/verification/history.
- Creator Free is a real selling tier; one-off paid publication acceleration is allowed without bypassing safety.
- Server paid model may use tiers plus one-time add-ons; Organization is billed per organization; NEXUS Pro is the widest bundle.
- Prices are globally consistent at base level with local currency display.
- Public Trust/Reputation tab is now confirmed, including exact completed transaction counts and historical public moderation state.
- New/low-trust forum/articles use premoderation; healthy authors may graduate to post-moderation.
- Perpetual and time-limited product licenses both exist.
- Perpetual DRM license persists indefinitely after activation except formal revoke/malware/legal/security cases; 7 days is offline grace only.
- Forensic watermarking is opt-in evidence and never enough alone for automatic guilt.
- NEXUS does not publish hard support response SLA before staffing can support it.
- Provider-agnostic payments remain until production legal/provider gate.
- Production commercial files target private object storage + signed CDN delivery.
- ClamAV remains baseline but scanner architecture is pluggable.

## Remaining explicit OPEN from Round 9

`OBS-010`: whether AI may select concrete production observability vendors/tools as a reversible PROVISIONAL decision or must seek owner approval first.