# ZERA audit safe v2 — review and acceptance (10 Nov 2026)

## Scope and evidence
- ZERA Clothing is an external **test customer**, not an AI Visibility Works tenant/operator.
- Verified in isolated Neon branch `br-fragrant-snow-b248fia4`: exact UUID filter, three output columns (`task_id`, `status`, `created_at`), no `failure_reason`, security barrier, one matching attempt.
- Actual `zera_audit_test_login_v2` connected and SELECT succeeded. Negative queries to the old view, `public.clients`, `public.zera_ai_task_attempts` and UPDATE were rejected.
- Removed unexpected SELECT on old view and schema future-table default SELECT from the test login. Broad Neon `read_only` grants are **not suitable** without narrowing.
- The test LOGIN credential was not added to Vercel or GitHub. Its password must be rotated before any further use, because creation returned the value via tooling. Do not log or commit secrets.

## Migration
`migrations/zera-audit-safe-v2-review.sql` is a manually reviewed, fail-closed candidate, based on the current #227 head. It creates only a NOLOGIN group and a narrowly scoped view on an authorized release.

## Acceptance before execution
1. Verify current branch, database identity, recent backup/restore capability, ZERA UUID, client count, schema and owner; confirm the definition references the intended revision.
2. Rehearse the SQL on a fresh throwaway Neon branch (the existing isolated branch already has the objects and intentionally fails the collision guard). Check transaction rollback on mismatch, rerun rejection, no access widening.
3. Review schema/view ownership and inherited/PUBLIC permissions. Verify view grants are only to the intended group, and no unrelated roles have SELECT.
4. Separately provision a LOGIN role without broad default SELECT grants; restrict it to **this one view**, never old views or future tables. Store rotating credentials in a server-only secret manager, not client/browser variables.
5. Exercise actual TLS LOGIN, allowed SELECT, denied SELECT on old view/underlying tables, denied DML and tenant isolation. Treat any failure as HOLD.
6. Only then review production migration, owner approval, PR exact-head CI, Vercel constraints and rollback. No automatic merge, deploy, customer actions or paid provider requests.

## Current release decision
**HOLD** — no production migration, deployment, checkout, email or provider request performed. A successful isolated query or CI run is not proof of production customer acceptance.
