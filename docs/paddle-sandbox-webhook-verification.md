# Paddle Sandbox webhook verification — 2026-10-13

## Provisioned test resources
- Vercel-managed Neon resource: ai-visibility-paddle-sandbox, Free plan, Frankfurt, Auth disabled.
- Store: store_ObUCJUy1fyj09cnt; provider project: wandering-bar-89949518.
- Connected only to preview; all 16 provisioned PADDLE_SANDBOX_* database variables further scoped to paddle-sandbox-integration.
- Two tables created and verified: paddle_sandbox_events and paddle_sandbox_entities. SQL editor returned to read-only mode.
- Paddle sandbox destination ntfset_01m4vcb0m6f57g3d7yw69fxdzv, platform + simulation, nine billing events. Its signature secret is a server-only sensitive Vercel variable scoped to the same preview branch.
- Hardened preview dpl_FXM2JuS8C68usWt6HQdk7Js5eqrk, commit 22e0e4c92f04653a1b7cf049a0857eb38f645515.
- URL: https://ai-visibility-ktcx8zpgl-ai-visibility2.vercel.app/paddle-sandbox

## Verified deployed behavior
Manually signed synthetic HTTP fixtures were delivered to the exact preview handler using an authenticated temporary Vercel access cookie. No checkout payment or real subscription was created.
- Invalid HMAC -> 401.
- Expired signature -> 401.
- Synthetic subscription activation -> 200, recorded=true, productionAccessChanged=false.
- Same event ID replayed -> 200, duplicate=true.
- Cancellation -> 200.
- Older active update after cancellation -> 200, but final state remained canceled.
- Database query confirmed sub_sandboxintegration01, status canceled, three unique events.
- /api/clients, /api/leads, /api/free-assessment, /api/cron/daily-cycle -> 404 on this preview.
- The synthetic transport added roughly six seconds before delivery; valid fixtures were signed for expected arrival within the existing five-second freshness window. The server tolerance was not changed.

Validation: all 295 tests passed; local Next.js build passed; Vercel build READY. A local symlink-only dependency build failed at filesystem root resolution and was corrected by using a local dependency copy; no application code workaround was required.

## Paddle-owned delivery boundary
Simulation ntfsim_01m4vcxjpvgfjmj0jmyx48mjkx was created for subscription.activated. Its first run returned 401 with Protected by Vercel Authentication, before reaching application signature verification. Its payload has been prepared for one real sandbox business-monitoring USD price (pri_01m4va09n9cpgjp6xqx2dysj20), but the edited payload has not been replayed yet.

A temporary Vercel share URL could let Paddle reach this locked-down preview without disabling Deployment Protection. Transmitting that access URL to Paddle requires specific user approval and has not been done. It must be removed from Paddle after verification, before expiry. No share token is recorded in this document.

Pending: direct Paddle-generated delivery and signed event acknowledgement; test checkout payment; real sandbox subscription creation, renewal, cancellation and failed payment lifecycle. Production entitlement remains unimplemented. No production deploy, main merge or live payment occurred.
