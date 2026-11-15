# AI Visibility Works — actual Neon acceptance evidence (read-only)

Date: 2026-11-15. Scope: **Neon PostgreSQL catalog only**, no customer rows, passwords, credential values, changes to roles/schema, migrations, payments or deployment.

## Production source

Neon project `ancient-water-34496424`, default branch `br-cool-cherry-b2r912on` (main, Vercel production branch). Catalog query executed using existing connector credentials; the connected identity was `neondb_owner`. The following are **verified existence checks**, not evidence that the application can access them:

| Production catalog object | Observed |
| --- | --- |
| `public.client_credentials` | exists |
| `public.ai_provider_comparisons` | exists |
| `public.verified_customer_settlements` | absent |
| `public.portal_verified_one_time_envelope_review(uuid,bigint,uuid,text)` | absent |
| `public.portal_verified_one_time_report(uuid,bigint,uuid,text)` | absent |
| any role matching `portal_gateway_reader_%` | absent |
| any role matching `portal_report_fn_owner_%` | absent |

**Conclusion: production strict signed-envelope acceptance BLOCKED.** No generic or owner connection can substitute for a dedicated role privilege proof. Catalog object presence does not prove existing-password login, real AI response, or authorized customer report retrieval.

## Isolated trial source

Same project, nonproduction branch `br-plain-poetry-b2u7f7a6`:

| Trial observation | Observed |
| --- | --- |
| `public.verified_customer_settlements` | exists |
| `public.portal_trial_one_time_report(uuid,bigint,uuid,text)` | exists |
| proposed `portal_verified_one_time_envelope_review` RPC | absent |
| trial reader `portal_gateway_reader_trial_20261114` | exists |
| function owner `portal_report_fn_owner_trial_20261115` | exists |
| function owner LOGIN / BYPASSRLS | false / false |
| reader EXECUTE on trial function | true |
| reader direct SELECT on `ai_provider_comparisons` | false |
| reader direct SELECT on `client_credentials` | false |

**Important:** trial function and proposed envelope RPC are different contracts. These catalog checks do not demonstrate current runtime success under the restricted function owner, one-time nonce/locking behavior, real customer session, settled payment or production readiness.

## Smallest safe next verification

1. Keep production HOLD. Complete reviewed trial-branch E2E using the real nonproduction reader and synthetic identities with fresh signed claim, including successful authorized result, denied cross-tenant/replay/suspension and transaction lock handling. Verify exact function-owner grants and SQL behavior; do not migrate or promote until proven.
2. Separately verify existing-password login against the current production auth path without changing any password or reading credential hashes into reports; use authorized customer-controlled login and redacted request status only.
3. Review a controlled migration and least-privilege rollout **only after** all required acceptance evidence and explicit deployment decision. OpenRouter's authenticated GET is not AI completion/zero-cost receipt evidence.

## Evidence classification

- **recent-evidence:** catalog existence/permission metadata observed directly through Neon connector on 2026-11-15
- **blocked:** production signed report, settlement and isolated reader dependencies
- **unknown:** production customer password acceptance, scoped real report, real OpenRouter completion and actual committed nonce/revocation acceptance
- **historical:** previously successful synthetic CI and earlier isolated trials; not substituted for live acceptance

No production or trial database mutations were made in this inspection.

## Follow-up: trial-branch function-owner privilege audit (2026-11-15)

Additional **read-only catalog queries** on `br-plain-poetry-b2u7f7a6` confirmed:

- `portal_gateway_reader_trial_20261114`: LOGIN=true; SUPERUSER/BYPASSRLS/CREATEDB/CREATEROLE/public-schema CREATE=false; direct SELECT on credentials, payments and raw comparisons=false.
- `portal_report_fn_owner_trial_20261115`: LOGIN=false; SUPERUSER/BYPASSRLS/CREATEDB/CREATEROLE/public-schema CREATE=false; comparison SELECT=true, credential/payment SELECT=false.
- `public.portal_trial_one_time_report`: SECURITY DEFINER=true, `search_path=pg_catalog`, owner is the narrow NOLOGIN role; trial reader has EXECUTE; PUBLIC EXECUTE=false.
- Legacy `public.portal_trial_verified_report` remains owned by `neondb_owner`, but trial reader EXECUTE=false and PUBLIC EXECUTE=false.
- `public.ai_provider_comparisons`: RLS=true, FORCE RLS=true, 2 policies; trial function owner SELECT=true and direct trial reader SELECT=false.
- `client_credentials` and `payments`: RLS disabled, but these **two trial roles** have no direct SELECT. This catalog check is not a complete production privilege or policy audit.

**Still blocked:** no current E2E SQL RPC execution under the restricted owner is established by these queries; neither claims/replay nor revocation was exercised. Proposed production envelope RPC is distinct and absent in production. Do not infer readiness, change grants, migrate, merge, or deploy.

## Follow-up: exact signed-envelope install preflight (2026-11-15)

A new set of **catalog-only** queries on isolated branch `br-plain-poetry-b2u7f7a6` compared the real trial schema to `migrations/portal-one-time-explicit-envelope-review.sql` without invoking signed claims or reading any secrets/customer rows:

| Proposed object / access | Observed in isolated branch |
| --- | --- |
| `portal_authz` schema | **absent** |
| `portal_authz.hmac(bytea,bytea,text)` | **absent** |
| `portal_authz.signing_keys` | **absent** |
| `portal_authz.consumed_claims` | **absent** |
| `public.portal_verified_one_time_envelope_review(uuid,bigint,uuid,text)` | **absent** |
| Existing `portal_authz_trial` schema and `portal_authz_trial.hmac(...)` | present; **not interchangeable** with proposed names |
| Current trial reader EXECUTE on legacy `portal_trial_one_time_report` | **true**; conflicts with proposed exclusive-RPC reader contract |
| Trial NOLOGIN function owner SELECT on `public.client_pilot_access` | **true**, after separately documented narrow trial-branch grant |
| Reader and function owner role memberships | zero for each |
| Database CREATE and public-schema CREATE | **false** for both |

`public.ai_provider_comparisons` has FORCE RLS and two permissive SELECT policies, including `portal_fn_owner_read_synthetic` with `USING (true)`. This broad *function-owner* read permits the definer to fetch rows across tenants. Cross-tenant isolation therefore depends critically on verified claim binding and explicit `WHERE client_id=p_tenant` inside the audited SECURITY DEFINER function, **not on that policy alone**.

**Install/acceptance decision: BLOCKED.** The proposed migration expressly says never auto-apply and does not grant the dedicated reader any EXECUTE permission. Provisioning, extension placement, NOLOGIN owner, exclusive RPC grant/revocation of trial RPC, all entitlement-writer lock coordination, signed request/replay/revocation tests and an authenticated restricted connection require a separate reviewed *isolated-only* change. A schema/object existence check is not a license to provision production secrets, impersonate a customer or migrate the default branch. Preserve Production HOLD.
