# Direct Paddle Sandbox delivery verified — 2026-10-13

## Isolation and deployment
- Separate project ai-visibility-paddle-sandbox-webhook (prj_PpHetMGOjOrxfpm8WfPcKtO6OlkP), source root sandbox-webhook. No production application routes or credentials are included.
- Neon resource ai-visibility-paddle-sandbox (store_ObUCJUy1fyj09cnt) attached only to Preview, using PADDLE_SANDBOX prefix. No database deployment branches requested.
- Enabled/sandbox flags and sensitive webhook signing secret configured only for Preview. No Git auto-deployment connection.
- Verified deployment dpl_8ZuA9RxySgj1c5rVEsS9aAt5MEka, source e3ca47cf73eb3b244917bf90fb4661033027d384, READY, target staging; runtime logs confirm environment preview.
- First deployment attempt was unexpectedly classified production by Vercel and immediately canceled before completion, with no credentials. Subsequent deployments explicitly used target staging.

## Provider-generated signed event delivery
User explicitly approved creating a separate-project automation access key and transmitting its webhook URL to Paddle Sandbox. Main project Deployment Protection was not changed. All four edited Paddle simulator fixtures used the known business-monitoring USD Sandbox price pri_01m4va09n9cpgjp6xqx2dysj20.

| Event | HTTP | Database evidence |
| --- | --- | --- |
| subscription.activated | 200 recorded=true, productionAccessChanged=false | ntfsimevt_01m4ve8480vapkpvz5ypf2w9m8; sample subscription active |
| subscription.canceled | 200 | ntfsimevt_01m4veck3djqvvg2tpkqnc2exk; same sample subscription canceled |
| transaction.completed | 200 | ntfsimevt_01m4vegn83knf0akyrqvhx0k10; sample transaction completed |
| transaction.payment_failed | 200 | query confirmed one recorded simulator event |

Final read-only SQL grouped simulator event IDs and returned one record for each of the four types. Subscription sample: sub_01hv8x29kz0t586xy6zn1a62ny. Transaction fixtures use Paddle's same sample transaction ID txn_01hv8wptq8987qeep44cyrewp9; these are separate synthetic event tests, not a real subscription/payment lifecycle. Completed fixture origin was set to subscription_recurring; no real scheduled renewal occurred.

Paddle simulator uses ntfsimevt_ rather than evt_ event IDs. The sandbox parser now accepts both prefixes after signature verification; malformed other IDs still fail closed. The five-second signature freshness window and known-price allowlist are unchanged. Untouched default simulator prices produced expected unknown-price failures; edited known catalog fixtures succeeded. Sanitized logging emits only a fixed validation label or error code, never payloads or credentials.

Validation: 296 application tests pass; seven isolated billing tests pass; local handler rejects GET with 405 and unconfigured POST with 404; deployed service build READY; direct signed Paddle deliveries and isolated database records verified.

## Cleanup and limits
Temporary automation access key revoked with regenerate=false; Vercel returned protectionBypass empty. Query credential removed from Paddle destination and notification destination deactivated after tests. No secrets in repository documentation. Test database and server-only signing configuration remain reusable behind protection.

Earlier cookie-share URL test and manual synthetic HTTP results are historical; this direct-delivery verification supersedes their pending provider-delivery status. No real checkout/card payment, actual Sandbox subscription, production entitlement provisioning, main merge or live payment occurred. Next work is test-card checkout and a real Sandbox subscription lifecycle, then a separately approved production integration.
