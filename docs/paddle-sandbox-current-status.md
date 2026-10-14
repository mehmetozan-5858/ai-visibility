# Paddle Sandbox current status — 2026-10-14 09:01 Europe/Istanbul

This note supersedes earlier preparation snapshots.

## Verified
- Eight Sandbox products and 32 regional price IDs; no live catalog/charges.
- Actual Sandbox successful monthly/one-time checkout, declined-card retry, cancellation; earlier seven signed events stored separately from simulator fixtures.
- First real timed provider renewal completed at Oct14 01:40 Istanbul; subscription then canceled. That run lacked an active destination, so its delivery was not claimed.
- Server-issued synthetic browser session → actual checkout-intent endpoint → USD169 Sandbox checkout → signed webhook → isolated owner-filtered account response verified. Customer test UI shows Business monitoring: Etkin. This fixture is not production customer signup/login or entitlements.
- Bound signed subscription_update credits with quantity -1 are now accepted only for exact previously bound monthly customer/subscription and known price, negative total. The actual credit transaction txn_01m4wfe317hze7pr381fq6t472 was retried through Paddle and returned 200 with recorded:true. Foreign owners, new claims and other quantities remain rejected.
- 316 tests and local Next.js build pass. Application browser preview dpl_8B74oeV4KHVTLwP6YM6DPFY1Qtib READY. Fixed isolated receiver dpl_3RK2jGzPC2pFdZBvGZ95tE8ufk5Q READY.

## ACTIVE timed test — do not prematurely deactivate
Linked real Sandbox subscription sub_01m4wfb2t3kh1z1hm9qw5gkt1d is scheduled for 2026-10-14 06:25 UTC /09:25 Europe/Istanbul. Synthetic customer sandbox-linked-renewal@example.com, initial transaction txn_01m4wf9zjayzrwywk5mwrrjr2j. Reopened billing-date editor confirms 06:25 AM Oct14. The preview amount USD0.14 is only a proration preview, not a guaranteed final amount.

Destination ntfset_01m4vcb0m6f57g3d7yw69fxdzv was active BEFORE linked checkout and remains active. Current receiver plain URL: https://ai-visibility-paddle-sandbox-webhook-16d3breg8-ai-visibility2.vercel.app/api/webhooks/paddle-sandbox. Its configured URL temporarily includes the scoped automation access key. Key is scoped only to isolated project prj_PpHetMGOjOrxfpm8WfPcKtO6OlkP, note Temporary end-to-end Sandbox recurring delivery test. No production project protection change.

After due time: verify actual subscription_recurring transaction.completed is Delivered and response recorded:true; inspect customer's own status; cancel this test subscription immediately; verify signed subscription.canceled and UI İptal edildi; revoke only this exact temporary access key without regeneration; strip query; deactivate destination. No live payment.

## Scope still separate
PR28 remains unmerged and Sandbox-only. Main Stage5 application customer journey passed independently after PR29 publication. Commercial launch, production entitlements/provider approval and general remaining application readiness gates are not closed by these Sandbox tests.
