# Combined customer acceptance — exact-head and production divergence (2026-11-11)

This review document is evidence classification, not release approval. ZERA is a separate test customer and not a core tenant or proof of real customer revenue.

## Offline acceptance verified
- Draft PR #240 exact head `429958d7a30dd5aa6f2203ad83872e0637672a56` passed CI (run 43084561670), Customer Journey Browser Acceptance (43084561607), and Web & Mobile Production Smoke (43084561609).
- The run names do not signify a live production deploy: they exercise synthetic/local test fixtures and a local browser instance.

## Separately observed Vercel production target
- Read-only Vercel deployment listing returned a READY production-target record `dpl_BtqQYxFaPmGpzZmkvDqMhiu5x9mn`, source SHA `95b6b1bd03e15fac1092ec218ab7f1e91deb740a`, created 2026-11-11T19:03:27Z.
- It is **not** the PR #240 head. READY indicates deployment build state; it does not prove canonical domain routing, real AI responses, signup, payments, or tenant isolation.
- GitHub compare: PR #240 head vs this Vercel SHA = **diverged**; 39 commits unique to the Vercel SHA and 11 unique to the combined-review head; merge base `8f8a1bba57740c2b1b28d1a7871a724c4753a724`. Counts describe revision graph differences, not live acceptance.
- Diverged source paths include `lib/paddle-live.js`, `lib/pilot-access.js`, `proxy.js`, real audit/revenue pilot routes, and related tests. Treat payment, auth and proxy behavior as revalidation required rather than assuming reviewed behavior is deployed.

## Strict live acceptance gates — still HOLD
1. Confirm canonical production alias and authoritative deployed commit without making changes.
2. Review production-target source divergence for customer authentication, proxy boundaries, paid access, signed Paddle settlements, refunds and tenancy. Create a new exact-head isolated integration candidate; do not auto-merge either direction.
3. Query required Neon schema **metadata only** from a verified production branch using a restricted reader; inspect expected columns and exact key definitions. Do not mutate schema or access customer rows for this preflight.
4. Verify one explicitly consented external customer can claim a business, authenticate, receive a limited verified free report and view only their own account. Protect tokens and never automatically send outreach.
5. Verify dated real provider API answers and persisted results separately from historical dashboard summaries and synthetic fixtures, under existing free/cost controls.
6. Independently verify a signed Paddle checkout/event and the tenant-specific paid report admission, including duplicate event, cancellation, refund and failure modes. Neither a `paid` label nor a zero-charge synthetic test is revenue.
7. Require an explicit separate production release decision after merged exact-head tests and authoritative evidence. This file neither authorizes nor performs deploy, merge, email, paid API calls, or production database modifications.

Source URLs:
- https://github.com/mehmetozan-5858/ai-visibility/pull/240
- https://github.com/mehmetozan-5858/ai-visibility/actions/runs/43084561670
- https://github.com/mehmetozan-5858/ai-visibility/actions/runs/43084561607
- https://github.com/mehmetozan-5858/ai-visibility/actions/runs/43084561609
- https://vercel.com/ai-visibility2/ai-visibility/BtqQYxFaPmGpzZmkvDqMhiu5x9mn
