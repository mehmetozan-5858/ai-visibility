# Real timed Sandbox renewal result — 2026-10-14

The scheduled Paddle Sandbox subscription sub_01m4vmc9bq5rr5ev5gy97fghcn renewed at 2026-10-13 22:40 UTC / Oct14 01:40 Europe/Istanbul. Provider dashboard and actual transaction txn_01m4vprh5z5vs5ccn26k88v5s4 show Subscription renewal, Complete. The final test amount paid was USD0.70, with USD168.30 credit applied to the USD169 catalog total. The earlier USD0.16 preview was not the final amount; no live money/card involved.

Subscription was canceled immediately on Oct14 05:33 UTC /08:33 Istanbul after inspection. No further test renewal remains scheduled.

Delivery gap: notification destination was inactive during the original checkout, renewal and cancellation. Its notification log contains only the earlier seven events from 20:24–20:30 UTC; no new renewal notification exists there. The transaction Actions menu offers refund/view subscription, not historical notification generation. Therefore this result closes the provider-side timed-renewal check ONLY, not renewal webhook persistence or browser-authenticated customer state.

A temporary access key scoped solely to the isolated Sandbox receiver was generated to inspect delivery options, its URL applied and destination temporarily activated. No new payment or event was generated during that interval. It was then revoked without regeneration; destination deactivated and plain URL restored, all verified. No production-project protection changed.

Remaining: repeat a timed renewal with the isolated receiver active throughout checkout/renewal and verify signed recurring event persisted; finish isolated browser customer-session → intent → checkout → own-status journey. PR28 still Sandbox-only, unmerged. Main Stage5 fix/customer journey passed independently and does not close these Paddle checks.
