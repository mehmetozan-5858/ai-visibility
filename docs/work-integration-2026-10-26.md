# AI Visibility integration checkpoint — 26 October 2026

## Source lineage

This candidate combines ZERA commit `69fd98df5377757821c37bfea8e7571cd1dc1e0a`
and Ar-Ge commit `5d8812eb0ba56ab7607e73992595e04be4447493` through integration
commit `d82383f1de4849e0404beeff1007de26f3ac22d6`. The two deltas have no
overlapping files. Both parent histories are retained. No main/PR ref was moved,
no merge request was activated and no Vercel deployment was requested.

## Added integration

- Explicit operator migration for tenant memberships, service grants, source
  revenue ledger, report previews and audit records. HTTP requests never run it.
- Signed-customer route `POST /api/client-audit-preview`, closed unless both
  `ARGE_REPORT_PREVIEW_ENABLED=true` and `ARGE_AUDIT_SERVICE_ENABLED=true`.
- Active customer access is required before storage access. Persisted owner
  membership and a valid, non-revoked Audit & Control grant are checked again
  inside the transaction. Browser JSON supplies only an idempotency request ID;
  it cannot supply tenant, role, consent, entitlements or financial records.
- Ledger records are read with the authenticated tenant predicate. A preview
  and its audit event commit together or both roll back. Committed previews
  survive storage restart. Authorization is rechecked before idempotent replay.
- A locked membership row serializes this customer scope. A fixed 30-preview
  UTC daily limit bounds new stored reports; authorized replays do not consume it.
- The Next proxy now recognizes the two exact customer service endpoints.
  Previously they fell through to admin authentication. Admin and similarly
  named routes remain protected. Request Origin is checked against inbound Host
  and transport, rather than Next's potentially different internal hostname.

## Validation on the combined local source

| Check | Result | Scope |
|---|---|---|
| `npm test` | 544 passed, 0 failed, 0 skipped | Complete Node test suite, including provider release hold and GitHub evidence adapter |
| PostgreSQL integration subset | 8 passed | File-backed PGlite/PostgreSQL: scope, atomic rollback, idempotency, revocation, expiry, restart persistence and daily budget |
| `npm run build` | Passed | Next 16.4.2 optimized production build |
| `node scripts/smoke-arge-preview.mjs` | 15 assertions passed | Real local production server: customer auth/request boundaries plus admin-triggered ZERA calls blocked before DB/provider access and honest readiness |
| Source transfer integrity | Canonical downloaded text checked against Git blob SHA-1 | EOF transport normalization only; intentional feature/package edits excluded |
| Dependency review | No existing runtime package versions changed | Adds pinned development-only `@electric-sql/pglite@0.5.12` for real PostgreSQL tests |

Reproduce with `npm ci`, `npm test`, `npm run build`, then
`node scripts/smoke-arge-preview.mjs`. The smoke process creates random local
test credentials and supplies no provider credentials or real database URL.
PostgreSQL fixtures are isolated temporary files and synthetic tenant ledgers.

## Not established by these checks

### Follow-up: existing provider safety drafts and source evidence

The existing PR #120 provider release gate and PR #125 shared-engine hold have
been incorporated into the current runner/single-scan routes and provider engine.
The gate runs after admin/origin authorization and before credential checks,
DB task claims or provider work. Environment flags and configured keys cannot
override it. Readiness returns `ready:false` and `customerReadiness:not-checked`
without probing customer storage when this release hold is closed. Actual local
HTTP tests use only synthetic credentials and verify 409 responses on both POST
routes plus a truthful non-starting readiness response.

`collectAiVisibilityRelease` now maps public GitHub check-run metadata and a
verified rollback commit into the existing Release Assurance gate. Repository,
required check names and GitHub Actions app identity are server policy. It
rejects partial pagination, untrusted apps, wrong commits and inconsistent source
data; a newer failed rerun supersedes an old success. Requests are bounded,
read-only and credential-free. Unit tests pass, but its direct live HTTP request
timed out in this environment; runtime GitHub source acceptance is **not** proven.

The bounded live TED probe examined two current notices and correctly failed
with `official_notices_parsed:0`, `official_notices_failed:2`. Its secure downloader
reported unresolvable public URLs; independent DNS lookups returned gaierror.
Separate fixed official-URL reads intermittently returned an empty HTTP 202.
An observed partial 200 response is not a complete parsed notice or attachment.
The production SSRF/DNS guards have not been weakened to work around this host.

The latest inspected Broker Vercel deployment remains BLOCKED at commit
`1f5c974fc5c1ad71ade1e3deca92e52f4ed95018`. Available read responses did not
expose the detailed blocking/billing reason or a reset date. Do not infer that
a budget reset/unpause has occurred, promise an unblock time, or change billing.

This is **not production acceptance**. No live migration, real customer write,
provider inference, email, payment, Vercel change or customer delivery occurred.
The new preview API is not yet connected to a customer-facing report UI.
PGlite validates PostgreSQL statements and storage semantics locally, not the
deployed database's permissions, concurrency, backups or performance. Exact
remote CI on the final checkpoint SHA is still absent because no branch push
was made. Feature flags remain disabled by default.

Real ZERA three-provider scanning, independent search evidence, scoring and
customer report acceptance remain blocked by the provider/cost release gate.
The actual Commerce Intelligence, Candidate Rediscovery and Voice Revenue
integrations are still pending; their existing preview catalogue is preserved.
Global Broker TED document access and Vercel pause, and Future Signal production
source recovery/hosted render integration remain separate blockers.

## Controlled staging and rollback

After deployment-trigger and cost checks, carry this source to an isolated
staging candidate and run remote CI on its exact SHA. Apply the migration only
to an authorized staging database. Grant only explicitly approved test tenants
and import actual authorized ledger evidence; never infer ownership or grants
from an existing paid/pilot plan. Keep production flags disabled until that
acceptance is complete.

Rollback disables both preview flags and restores the prior reviewed source.
Retain new report/audit tables and records for investigation; do not automatically
drop customer data. All production configuration/deployment actions remain
subject to the user's separate release approval.
