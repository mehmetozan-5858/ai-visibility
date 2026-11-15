# ZERA + Paddle production release gate (2026-11-01)

This is an evidence and rollback checklist, **not** permission to merge or deploy.

## Pinned source and evidence
- Draft PR #216 exact head: `defcce35ebb5fdb78bc4974f06bc085becb052c8`.
- GitHub CI #41278400674: SUCCESS.
- Web & Mobile Production Smoke #41278400750: SUCCESS.
- Production Vercel currently observed at `ffa9ab263a45c29726f396c8944f375057e365a9`. Preserve its deployment ID, URL and environment references before an approved rollout.
- PR #216 combines ZERA PR #212 and Paddle PR #215; superseding either without an exact-head review is prohibited.

## Acceptance gates (currently CLOSED)
1. **ZERA history:** Authenticated GET at `/api/clients/zera-ai-runner` must identify the actual prior German attempt without clearing it: `brand-ai-de` status `provider-failed`, `failureReason:null`; `brand-ai-tr` pending. Prior recorded attempt is immutable; never auto-retry, reset or falsely assert cause.
2. **ZERA real analysis:** With separately approved provider call, verify quota/cost constraints and authenticated operator execution, valid Gemini result, stored comparison ID, correct tenant ownership, verification label, report and intended email delivery. Metadata lookup and schema preparation are NOT proof.
3. **Paddle delivery:** Verify provider-signed notification to exact production endpoint, accepted signature, durable event idempotency, tenant/payment linkage, completed-only activation, refunded/non-revival, delayed/out-of-order event safety and customer view. Never treat a synthetic fixture as real provider delivery. Do not create paid checkout without explicit approval.
4. **Access/security:** Confirm admin-only ZERA diagnostics, same-origin mutation restrictions, no secrets in logs/responses, tenant-scoped payment record, unchanged authorization before and after release.
5. **Deployment:** Re-check main/head compatibility, exact-head CI and smoke, environments, production alias, error budgets, and written operator approval; no unpause or budget change without authorization.

## Safe rollback plan (only after authorized deployment)
- Before rollout: snapshot deployment ID/commit of last known READY production; record current production alias, accessible read-only route checks, and authorized operator.
- Deploy only the explicitly approved, tested SHA. Inspect runtime errors and authenticated ZERA/Paddle status without triggering provider calls or charging.
- If errors, bad customer isolation or wrong payment state occur: stop new provider/payment actions, restore the **verified prior deployment** using normal Vercel rollback controls with separate authorization; verify alias, health, auth boundaries, and old attempt history. Do NOT delete historical payments, idempotency markers, attempts or reset subscriptions.
- Rollback restores application code, **not database state**; any DB schema/data change needs its own forward-compatible migration and restoration plan.
- Final acceptance must show real provider end-to-end evidence, not only CI green.

Release state: HOLD. No merge, production deployment, live Gemini request, customer mutation, charge or spending change authorized by this document.
