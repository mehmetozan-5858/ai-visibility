# Paddle Sandbox current status — 2026-10-14 09:35 Europe/Istanbul

This note supersedes earlier preparation snapshots. Sandbox integration validation is closed; commercial launch remains separate.

## Verified
- Eight Sandbox products and 32 regional prices aligned to application pricing; no live catalog or charges.
- Actual one-time and monthly Sandbox checkout, declined-card retry, activation, cancellation and signed event persistence.
- Protected synthetic browser session → server-issued checkout intent → USD169 monthly checkout → signed webhook → isolated owner-filtered account response showed Etkin.
- Actual linked timed renewal at 2026-10-14 06:25 UTC: transaction txn_01m4whc2awvax7z1znpbm04h60, Complete, final Sandbox amount USD0.70 (earlier USD0.14 preview was not final). Notification ntf_01m4whc6aknq9c19mc2s1nqnh9 succeeded on its first attempt, response 200 recorded:true and productionAccessChanged:false.
- Linked subscription sub_01m4wfb2t3kh1z1hm9qw5gkt1d was canceled at 06:29 UTC. Notification ntf_01m4whmmwafrrn9ettdh2jc2y1 subscription.canceled succeeded on first attempt with 200 recorded:true. The same authenticated synthetic customer UI changed to İptal edildi.
- The negative proration credit guard accepts only a previously bound monthly intent with exact price/customer/subscription, subscription_update origin and negative total. Its actual credit retry succeeded; foreign owners and initial claims remain rejected.
- 316 tests and Next.js build passed on the Sandbox code line.

## Cleanup
- Exact temporary recurring-test access key revoked without regeneration. Isolated receiver project protectionBypass is empty; main project protections were unchanged.
- Destination ntfset_01m4vcb0m6f57g3d7yw69fxdzv URL now has no access-key query and is inactive.
- Test subscription canceled; test records retained for audit. No active renewal test remains.
- Ephemeral local access-key file removed.

## Scope
PR28 remains unmerged and Sandbox-only. Synthetic sessions do not establish real production signup/login or live entitlements. No real payment or Paddle live launch was performed. Production customer onboarding, email round-trip, recovery device enrollment, legal identity and authenticated production mobile review remain separate application gates.
