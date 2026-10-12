# AI Visibility — Launch Closure Gate

Updated: 2026-10-12

This file is the source of truth for declaring AI Visibility production-ready. A capability is not counted as complete merely because code exists; the production path must also be verified.

## Verified complete
- [x] GitHub CI test suite passes on the current production line.
- [x] Production Next.js build succeeds.
- [x] Vercel project is linked to `mehmetozan-5858/ai-visibility` and deploys `main`.
- [x] Production aliases include `aivisibilityworks.com` and `www.aivisibilityworks.com`.
- [x] Latest production deployment for commit `cac9718f16d83fa3317f12ecdb858273005a56f9` reached `READY`.
- [x] No grouped Vercel production runtime errors were present in the 24-hour check performed on 2026-10-12.
- [x] Premium public site, customer login/onboarding, private customer/report indexing rules and payment-page privacy protections are on `main`.
- [x] Sales preparation queue, bounded outreach, evidence-backed preliminary scoring, price experiment, score-vs-curiosity experiment and guarded adaptive allocation are on `main`.
- [x] Stale draft PRs that were superseded by production work are closed rather than merged into the current line.

## Must be verified before commercial launch is declared complete
- [ ] Production customer journey: public site -> lead/onboarding -> customer authentication -> report/customer portal.
- [ ] Payment journey: supported payment or manual-bank path -> exact invoice/currency -> confirmation -> service activation -> customer access.
- [ ] Email journey: verified sender -> first outreach -> provider acceptance/delivery -> inbound reply intake -> CRM state -> follow-up suppression when a reply/customer/opt-out exists.
- [ ] Admin journey: sign-in -> operational dashboard -> customer/prospect review -> payment review -> manager report without privilege or same-origin regressions.
- [ ] Scheduled automation journey: scheduler authentication -> discovery/preparation -> bounded outreach -> daily reporting; no duplicate work across reruns.
- [ ] Recovery journey: admin/customer password recovery and any configured multi-factor recovery work end-to-end in production.
- [ ] Backup and restore: source archive, production data backup, recovery instructions and at least one restore/readback verification are documented.
- [ ] Production environment review: required variables exist in the correct Vercel environment without exposing secret values; unused/stale variables are identified.
- [ ] Spend controls: AI/provider budgets, outreach caps and failure-safe behavior are verified in production configuration.
- [ ] Mobile/responsive smoke test: homepage, login, onboarding, customer portal and core admin pages work on a narrow mobile viewport.
- [ ] Legal/customer-facing copy review: privacy, service scope, payment/refund language and unsupported performance claims are checked before paid acquisition.

## Launch policy
Commercial launch is **GO** only when every item in the section above is checked or explicitly marked non-applicable with evidence. Until then the application may run in controlled production/pilot mode, but it must not be described internally as fully closed.

## Safety rules
- Never paste API keys, database credentials, payment secrets, recovery secrets or private customer data into source files, screenshots, issues or chat messages.
- Keep credentials in the hosting/provider secret store with least privilege.
- Do not bypass authentication, payment, recipient-verification, opt-out, rate-limit or spend-limit gates to make a checklist item pass.
- Failed or unavailable measurements stay unknown; they are never converted into successful zero values.
