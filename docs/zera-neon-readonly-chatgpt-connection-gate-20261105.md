# ZERA Neon production — least-privilege ChatGPT connection gate (2026-11-05)

**Status: NOT CONNECTED. DO NOT APPROVE OWNER-LEVEL OAUTH OR DEPLOY.**

## Verified by operator in Neon SQL Editor

- Project: `ancient-water-34496424`; branch `main`; database `neondb`.
- Audit NOLOGIN group role `zera_audit_reader`: no superuser/createdb/createrole/replication/inherit/login flags.
- `zera_audit.attempt_status` view is filtered by `clients.name = 'ZERA Clothing'` and shows task_id, status, failure_reason, created_at.
- `zera_audit_reader` has schema USAGE and view SELECT but not direct SELECT on `public.clients` or `public.zera_ai_task_attempts`; `restricted_access_ok=true`.
- `SET LOCAL ROLE zera_audit_reader` from owner failed SQLSTATE 42501 and transaction was rolled back.
- Historical ZERA provider failure exists with `failure_reason=NULL`; no completed provider comparison in `ai_provider_comparisons`.

## Official Neon MCP capabilities

The upstream source (https://github.com/neondatabase/mcp-server-neon) documents a fixed grant via URL `readonly=true`, `projectId`, `category`, and `roleName` (verify against version deployed). Example **template only**, not usable with current NOLOGIN role:

`https://mcp.neon.tech/mcp?readonly=true&projectId=ancient-water-34496424&category=querying&roleName=<VERIFIED_LOGIN_ONLY_ROLE>`

The prebuilt ChatGPT Neon application must be confirmed to support this **exact immutable scoped URL**. User authorization is always required. Previous console OAuth showed powerful general administration scopes; never approve on the assumption that a SQL role alone limits management APIs. The upstream server cautions against Neon MCP production use. Read-only query mode prevents writes but does NOT itself guarantee view-only row/column visibility.

## Required preflight before any LOGIN role is created

1. Verify connector supports custom scoped MCP URL and actual OAuth grant is read-only, single-project, querying-only, pinned role. Otherwise STOP and use manual SQL Editor audits.
2. Audit `PUBLIC` and inherited privileges across `neondb` (including other schemas and routines); audit role membership and default grants. Never grant broad `SELECT ON ALL TABLES`.
3. On a disposable test branch, define a **separate login role with no administrative attributes**. Only inherit SELECT on `zera_audit.attempt_status`; ensure no other usable grants. Verify access with an authenticated session as that role and negative SELECT tests for `public.clients`, `public.zera_ai_task_attempts`, `public.ai_provider_comparisons` and other tenant tables. Do NOT distribute its password in chat/GitHub.
4. Verify the view's definer semantics, ownership, revocations and isolation, and test that it returns only ZERA tasks with no secrets/customer PII.
5. Only after these tests, present exact scope to user and request their OAuth authorization. Never use `neondb_owner`.
6. If any gate fails, do not connect production. Prefer a separately authenticated, read-only audit endpoint with restricted queries and no public exposure, also requiring code review and release authorization.

## Other release blockers (independent)

- Paddle Live: one `ready` transaction, no completed/settlement proof; webhook endpoint active but delivery not established. No payments without user approval.
- Global Broker PR #218: 14 isolated TED tests previously passed; real TED technical annex and exact-head full CI unverified; Vercel blocked.
- Future Signal PR #44: isolated video guards passed; full CI, H.264/AAC MP4 and iPhone playback absent.
