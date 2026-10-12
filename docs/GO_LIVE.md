# AI Visibility — Launch Closure Gate

Updated: 2026-10-12

This file is the source of truth for declaring AI Visibility production-ready. A capability is not counted as complete merely because code exists; the production path must also be verified.

## Verified complete
- [x] GitHub CI test suite passes on the current production line using Node 24, matching the production major runtime.
- [x] Production Next.js build succeeds.
- [x] Vercel project is linked to `mehmetozan-5858/ai-visibility` and deploys `main` when explicitly released.
- [x] Production aliases include `aivisibilityworks.com` and `www.aivisibilityworks.com`.
- [x] Latest verified production deployment for commit `2fd043cd28d390de252891161cf3d3ab62a78acc` reached `READY` and was mapped to both production domains after applying the approved AI budget limits.
- [x] No grouped Vercel production runtime errors were present in the 24-hour check performed on 2026-10-12 after the latest production release.
- [x] Premium public site, customer login/onboarding, private customer/report indexing rules and payment-page privacy protections are on `main`.
- [x] Sales preparation queue, bounded outreach, evidence-backed preliminary scoring, price experiment, score-vs-curiosity experiment and guarded adaptive allocation are on `main`.
- [x] Scheduled automation was re-run against production on 2026-10-12 after repairing strategy-learning canonicalization; strategy learning plus the business, creator, inbox, preparation, first-contact, follow-up, implementation and guard/health jobs all completed successfully.
- [x] Payment safety tests cover exact invoice currency/amount preservation, atomic activation, bank-evidence mismatch rejection, bank-reference reuse prevention and rollback on audit failure.
- [x] Communication safety tests cover test-sender blocking, unsupported-claim rejection, safe permission enquiries and read-only delivery verification without exposing provider credentials.
- [x] Public/customer-entry mobile smoke now runs against the exact built commit at a 390×844 touch/mobile Chromium viewport. After fixing three real horizontal-overflow defects, homepage, customer login, new-customer onboarding, services and demo all passed 5/5; the same application commit was then deployed to production and the formerly affected routes returned HTTP 200.
- [x] Production AI spend controls are active: `DAILY_AI_BUDGET_USD=1` and `MONTHLY_AI_BUDGET_USD=10`. After redeploy, the production budget-guard returned `dailyBudget:1`, `monthlyBudget:10`, `mode:normal`, `daySpend:0.01039`, `monthSpend:0.10461`, and the configured 70/85/100% throttle logic remains active. Cost coverage is not yet complete because 829 ledger entries were marked with unknown/unconfigured pricing telemetry, so provider-account billing caps and billing review remain a separate operational safeguard.
- [x] KVKK disclosure structure now covers controller identity configuration, purposes, legal bases, collection methods, recipient groups and data-subject rights. Current official KVKK guidance was reviewed on 2026-10-12.
- [x] Stale draft PRs that were superseded by production work are closed rather than merged into the current line.

## Must be verified before commercial launch is declared complete
- [ ] Production customer journey: public site -> lead/onboarding -> customer authentication -> report/customer portal. The components and access tests exist; a controlled production E2E session is still required.
- [ ] Payment journey: supported payment or manual-bank path -> exact invoice/currency -> confirmation -> service activation -> customer access. Security/atomicity tests pass; a controlled production E2E payment path is still required without creating an unintended real charge.
- [ ] Email journey: verified sender -> first outreach -> provider acceptance/delivery -> inbound reply intake -> CRM state -> follow-up suppression when a reply/customer/opt-out exists. Safety and delivery tests pass; one controlled production round-trip is still required.
- [ ] Admin journey: sign-in -> operational dashboard -> customer/prospect review -> payment review -> manager report without privilege or same-origin regressions. Route protections are tested; an authenticated production UI session is still required.
- [x] Scheduled automation journey: scheduler authentication -> discovery/preparation -> bounded outreach -> reporting/learning cycles; rerun verified after the duplicate strategy-key fix.
- [ ] Recovery journey: admin/customer password recovery and any configured multi-factor recovery work end-to-end in production. Admin recovery intentionally remains fail-closed until the second (phone/SMS) channel is configured.
- [ ] Backup and restore: source/recovery instructions are documented in `docs/BACKUP_RESTORE.md`, but production database backup creation and an isolated restore/readback are still required.
- [ ] Production environment review: core variables were reviewed and two Resend secrets were upgraded to `sensitive`; required phone/SMS recovery configuration and `DATA_CONTROLLER_NAME` remain owner/provider inputs before full commercial GO. AI budget limits are now configured and verified.
- [x] Spend controls: outreach caps are active at 5 per cycle and 50 per day. Production AI budget limits are set to $1/day and $10/month and were verified by the live budget-guard after redeploy; 70/85/100% throttle thresholds remain active. Provider billing caps should still be maintained because application cost telemetry is incomplete.
- [ ] CI/CD release path: Git linkage was re-confirmed on 2026-10-12, but a harmless docs-only `main` commit (`94c2e742e167e615227525c65ca2f801908e997d`) produced no Vercel deployment or Vercel GitHub status. A subsequent tested merge also produced no deployment until an explicit release was created. `docs/RELEASE_PROBE_2026-10-12.md` records the evidence. The external Vercel↔GitHub push trigger/authorization must be repaired before this gate passes.
- [ ] Authenticated mobile smoke: the five unauthenticated/public-customer entry routes are verified at mobile width, but the authenticated customer portal and core admin screens still need mobile visual verification as part of their controlled production E2E sessions.
- [ ] Legal/customer-facing copy review: KVKK structure was strengthened using current official guidance and consumer pages preserve mandatory rights, but `DATA_CONTROLLER_NAME` must contain the real public legal identity and final commercial legal review remains required before paid acquisition.

## Launch policy
Commercial launch is **GO** only when every item in the section above is checked or explicitly marked non-applicable with evidence. Until then the application may run in controlled production/pilot mode, but it must not be described internally as fully closed.

## Safety rules
- Never paste API keys, database credentials, payment secrets, recovery secrets or private customer data into source files, screenshots, issues or chat messages.
- Keep credentials in the hosting/provider secret store with least privilege.
- Do not bypass authentication, payment, recipient-verification, opt-out, rate-limit or spend-limit gates to make a checklist item pass.
- Failed or unavailable measurements stay unknown; they are never converted into successful zero values.
