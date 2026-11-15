# Consolidated portfolio integration — 2026-11-08

## AI Visibility candidate
Prepared work is combined in `integration/rd-acceptance-20261108`:
- Actor-scoped Audit & Control, Revenue Integrity and Release Assurance modules from existing RC `76fe7023ba9f8b88bee7bb68a107c5979f84dc7a`.
- Command queue, SQLite/PostgreSQL ledger and signed-agent identities from `db281cfc0827187e0e20a38e081f824c2712ed5e`.
- Prepared mobile styling, optional plan for free assessment, explicit demo score labels and hardened GEO evidence contract.
- Integration fix: exact command POST delegates authentication to its signed-agent handler after sandbox isolation. Admin GET and neighboring routes retain cookie authentication.
- Admin Ar-Ge console reads actual capabilities and, when provisioned, only the explicitly configured actor's task/audit scope. Missing/unreadable storage is not represented as zero tasks or success.

The console is `/admin/arge`, linked from existing `/admin/lansman-kontrol`. It never issues credentials, enables services or calls providers. `AGENT_COMMAND_ADMIN_ACTOR_ID` must name a server-registry identity with only the project/tenant scope this administrator may read. Configuration presence is not connectivity proof.

The legacy tenant-only customer token is not promoted to a verified actor. Customer-facing Audit & Control delivery still requires a real actor/session resolver, memberships, consent/entitlement records and schema. The imported report/ledger modules are not falsely described as publicly available customer products.

## Cross-project adapters
Global Broker now has `src/command_control_review.py`; Future Signal has `src/lib/command-control-review.mjs`. Both prepare deterministic revision-dependent enqueue/review plans from explicit boolean evidence. Missing checks remain unknown, no release is authorized, and outbound submission is disabled by default. Explicit submission requires a short-lived signed agent token and targets only the fixed shared API. No token, evidence body, model request, email or commercial contact was sent during validation.

## Local validation
- AI Visibility full integrated suite: 520 passed, including the admin-scope regression; production build succeeded after clearing an invalid generated Turbopack cache. The tested candidate includes the final proxy and admin-scope changes.
- Built Next.js HTTP smoke passed: anonymous admin-status rejection, a synthetic signed admin session, private Ar-Ge page, invalid agent token rejection, and valid signed POST reaching its own handler without an admin cookie. Missing command database returns 503. This did not test database-backed password login.
- Global Broker integrated candidate: 779 Python and 99 JavaScript tests passed, including the new adapter tests. These are offline/source-fixture tests, not live TED acceptance.
- Future Signal: 30 tests passed and production build succeeded. A synthetic 9:16 H.264/yuv420p + AAC MP4 passed FFprobe and full FFmpeg decode; a silent MP4 was rejected. This proves the local verifier, not an app-worker render or iPhone playback.
- Browser verification was attempted: normal Chromium download was invalid/truncated; an alternate bundled browser could not launch in this runtime. No desktop browser, iPhone Safari or mobile visual pass is claimed.

## Live evidence and access blockers
- Connected Neon SQL reports `transaction_read_only=on`; no production DDL or write was attempted. Dedicated writable command storage and schema are still unprovisioned.
- Connected AI Bridge is online but exposes read-only tools and disabled inference; no other model has been dispatched.
- Vercel AI Visibility latest observed preview `dpl_ASc5tTQ14h9qhAMGJL3z7mjKSZz6` is BLOCKED; observed production `dpl_4o1JyPTRYGAqpRMjRrLF7fP3B36q` is READY at old main `ffa9ab263a45c29726f396c8944f375057e365a9`.
- Vercel Global Broker latest observed production `dpl_AiF2YJJVo2sKwbbLHFpJtgb2GBaX` is BLOCKED at `cc853a78d23379821866df3e4ee623235f94cdb0`. Deployment metadata does not establish the exact billing/pause/root cause.
- Future Signal's observed READY preview `dpl_6M5UpVdm77QkkSK7bc9bWJdYn41g` is an older candidate, not this integration.
- Broker authoritative annex re-fetch, 13 spreadsheet formula decisions, PDF visual review, revision/lot completeness and exact-head live source acceptance remain unresolved.
- Future Signal private worker transport, actual produced media, source/content acceptance and real iPhone playback remain unresolved.

## R&D scope accounting
Audit & Control, identity/permissions, Revenue Integrity, Release Assurance and GEO evidence now have code in the consolidated candidate. Broker/Future review adapters are implemented. These do not make the entire live service complete.

Render Sandboxes/scoped credentials/OIDC, Runpod Batch/alternative models, ADK evaluation, Churn Radar, Voice Revenue Agent, Candidate Rediscovery, Commerce Intelligence and Advertising Lab are still research/module candidates; none is falsely marked deployed. External resource/provider pilots require current service availability, cost verification, credentials and module-specific acceptance. ZERA remains only a test customer.

User approval covers continued implementation. Remaining release restrictions are technical acceptance and access capabilities, not a request to repeat approval. No merge, paid resource, migration, email, commercial transaction or production deployment was performed in this work.
