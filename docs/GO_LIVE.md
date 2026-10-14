# AI Visibility — Launch Closure Gate

Updated: 2026-10-14 (PR31/PR32 publication and approved production intake verification)

This file is the source of truth for declaring AI Visibility production-ready. A capability is not counted as complete merely because code exists; the production path must also be verified.

## Verified complete
- [x] GitHub CI test suite passes on the current production line using Node 24, matching the production major runtime.
- [x] Production Next.js build succeeds.
- [x] Vercel project is linked to `mehmetozan-5858/ai-visibility` and production branch `main`.
- [x] Free TOTP Authenticator recovery code and enrollment screen deployed via PR #20 (production commit `bf5468781a7dcbfd3378dc2472b0675c5237db6c`, READY); current live settings confirm Authenticator configured and ready. A controlled recovery reset remains unverified.
- [x] Automatic GitHub -> Vercel production release path is verified: probe commit `0cae733392045059d1e21fedffd8567437061a81` automatically created deployment `dpl_5NadLYG8qqiUK5GiAGSHYURRKoQB`, which reported `source: git`, reached `READY`, and mapped both production domains without a manual deployment API call.
- [x] Production aliases include `aivisibilityworks.com` and `www.aivisibilityworks.com`.
- [x] No grouped Vercel production runtime errors were present in the 24-hour checks performed during launch closure.
- [x] Premium public site, customer login/onboarding, private customer/report indexing rules and payment-page privacy protections are on `main`.
- [x] Sales preparation queue, bounded outreach, evidence-backed preliminary scoring, price experiment, score-vs-curiosity experiment and guarded adaptive allocation are on `main`.
- [x] Scheduled automation was re-run against production after repairing strategy-learning canonicalization; strategy learning plus the business, creator, inbox, preparation, first-contact, follow-up, implementation and guard/health jobs completed successfully.
- [x] Payment safety tests cover exact invoice currency/amount preservation, atomic activation, bank-evidence mismatch rejection, bank-reference reuse prevention and rollback on audit failure.
- [x] Communication safety tests cover test-sender blocking, unsupported-claim rejection, safe permission enquiries and read-only delivery verification without exposing provider credentials.
- [x] Public/customer-entry mobile smoke runs against the exact built commit at a 390×844 touch/mobile Chromium viewport. After fixing three real horizontal-overflow defects, homepage, customer login, new-customer onboarding, services and demo passed 5/5.
- [x] Production AI spend controls are active: `DAILY_AI_BUDGET_USD=1` and `MONTHLY_AI_BUDGET_USD=10`; the live budget guard verified the limits and normal mode with 70/85/100% throttle logic active.
- [x] KVKK disclosure structure covers controller identity configuration, purposes, legal bases, collection methods, recipient groups and data-subject rights.
- [x] Stale draft PRs superseded by production work are closed rather than merged.

- [x] Controlled synthetic customer Stage 5 passed on production after PR #29 publication (commit `f00ebf7be8ccb8ad2211498c8b896652fde1941a`): owner screenshot at 00:40 Istanbul confirmed email verification → account preparation → real customer login → portal → score-42 fixture → PDF download. No real payment. This is evidence for that controlled chain, not public lead-form submission or a live provider payment.

- [x] PR31 and PR32 are merged and published. Production commit `526c8eed9fd3544a3dd1447fb915b46a42af5d52`, deployment `dpl_Xw2rAm473DpHkPs3MwAGqcypDupp`, READY on both domains. Final code CI: 300 tests/build passed; mobile fixtures 8/8 passed. The regional English form stays English despite a Turkish saved preference; incoming leads now appear in the protected customer-management page with server-derived regional prices and retryable read failures. Live read-only health checks passed; the short post-release grouped error scan returned no entries.
- [x] Approved live intake/list verification at 2026-10-14 11:04 Europe/Istanbul: owner specifically authorized one synthetic production lead. The Germany/English public form returned Application received and the protected admin list displayed AI Visibility Closure TEST 20261014, business-monitoring, Germany and EUR159/month. One synthetic lead was saved and read; no conversion, outreach, email, payment, customer activation or credential change was performed. This closes the public-form → persisted lead → protected admin-list segment; broader onboarding/authentication/fulfillment remains separate.

## Must be verified before commercial launch is declared complete
- [ ] Production customer journey: public site -> lead/onboarding -> customer authentication -> report/customer portal. The components and access tests exist; a controlled production E2E session is still required.
- [ ] Payment journey: supported payment or manual-bank path -> exact invoice/currency -> confirmation -> service activation -> customer access. Security/atomicity tests pass; a controlled production E2E payment path is still required without creating an unintended real charge.
- [ ] Email journey: verified sender -> first outreach -> provider acceptance/delivery -> inbound reply intake -> CRM state -> follow-up suppression when a reply/customer/opt-out exists. Safety and delivery tests pass; one controlled production round-trip is still required.
- [x] Admin journey (desktop): owner secure sign-in, operational dashboard, customer/prospect list, manager reports, payment review center and read-only health checks were observed on 2026-10-14 against production commit `90c12848901becc6acd3b6bac05364dd6e15fb31`. No payment approvals, outbound messages or customer writes were performed. Authenticated mobile verification remains a separate open gate below. See `docs/admin-session-verification.md`.
- [x] Scheduled automation journey: scheduler authentication -> discovery/preparation -> bounded outreach -> reporting/learning cycles verified after the duplicate strategy-key fix.
- [ ] Recovery journey: production settings now confirm email and Authenticator configuration ready. Device enrollment/activation must not be requested again based only on the old phone field. A controlled production admin/customer recovery reset remains unverified and credential changes require owner participation.
- [x] Backup and restore: `docs/BACKUP_RESTORE.md` records the 2026-10-12 manual snapshot, isolated restore to `br-winter-haze-b2nwbosh`, and representative row-count readback. Production remained unchanged. This is historical verified evidence; refresh the manual snapshot before a new risky production release or schema migration.
- [x] Production environment review: current live status confirms database, three AI providers, administrator authentication, email and Authenticator recovery configuration, inbound email and budget controls. KVKK publicly displays the configured controller identity. Earlier secret classification review is recorded above; no secrets or protections were changed by PR31/PR32. Actual recovery and commercial legal review remain separate gates.
- [x] Spend controls: outreach caps are active at 5 per cycle and 50 per day. Production AI budget limits are $1/day and $10/month with 70/85/100% throttle thresholds active.
- [x] CI/CD release path: automatic GitHub -> Vercel production deploy was verified with exact-SHA evidence after repository-side Git deploy settings and GitHub App repository access were repaired.
- [ ] Authenticated mobile smoke: public/customer entry routes are verified at mobile width, but authenticated customer portal and core admin screens still need mobile visual verification as part of controlled production E2E sessions.
- [ ] Legal/customer-facing copy review: DATA_CONTROLLER_NAME is present and the live KVKK page displays Mehmet Ozan Ekmekci. Missing controller configuration is no longer an open technical issue; final commercial legal/copy review remains open.

## Launch policy
Commercial launch is **GO** only when every item in the section above is checked or explicitly marked non-applicable with evidence. Until then the application may run in controlled production/pilot mode, but it must not be described internally as fully closed.

## Safety rules
- Never paste API keys, database credentials, payment secrets, recovery secrets or private customer data into source files, screenshots, issues or chat messages.
- Keep credentials in the hosting/provider secret store with least privilege.
- Do not bypass authentication, payment, recipient-verification, opt-out, rate-limit or spend-limit gates to make a checklist item pass.
- Failed or unavailable measurements stay unknown; they are never converted into successful zero values.

## Sandbox billing evidence (separate from production launch gates)

PR #28 contains successful Sandbox card checkout, activation, cancellation, failed-card retry and signed webhook storage. A real provider-side timed renewal was verified separately. The protected Sandbox preview also verified server-issued synthetic browser session → actual intent endpoint → checkout → isolated own-status response. The linked recurring-event delivery test is tracked in that PR's current Sandbox status notes; consult those notes for active-test and cleanup state. These tests do not close the production payment/entitlement gate above, and no real charge or Paddle live launch was performed.

## Approved production write test — complete
An earlier automatic approval review rejected the synthetic lead write for lack of specific authorization. The owner then explicitly approved the exact fixture and save/read-only scope at 11:04 Europe/Istanbul. The normal public UI submission succeeded; the same fixture was verified in the protected admin list. No alternate route or bypass was used.

Fixture: AI Visibility Closure TEST 20261014; contact Synthetic test — no outreach; email closure-test-20261014@example.com; reserved .local website; Germany; business-monitoring; EUR159/month; status New. Retained as an identifiable synthetic audit record. No conversion or contact actions were taken.
