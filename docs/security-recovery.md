# Security Shield & Recovery

## Purpose
Keep the production service available during abuse or attack, limit unauthorized access, and make recovery fast and repeatable.

## Layer 1 — Prevention
- Vercel Firewall and DDoS mitigations remain enabled.
- Authentication endpoints keep application-level same-origin checks and rate limits.
- Admin-only APIs require a valid admin session.
- Customer APIs require the appropriate client session.
- Production responses use HSTS, MIME-sniffing protection, clickjacking protection, strict referrer policy, a restrictive permissions policy, and same-origin opener isolation.
- Secrets and private key files must never be committed to Git.

## Layer 2 — Detection and Containment
- Review Vercel Firewall denied/challenged traffic and runtime error clusters when abnormal traffic appears.
- During a confirmed application-layer attack, enable Vercel Attack Mode temporarily and disable it once traffic normalizes.
- If one endpoint is abused, tighten that endpoint's rate limit before applying a site-wide challenge.
- Never expose credentials, TOTP secrets, recovery codes, API keys, webhook secrets, or payment secrets in tickets, screenshots, logs, or source control.

## Layer 3 — Recovery
1. Identify the last known-good production deployment.
2. If a release introduced the incident, use Vercel Instant Rollback to restore the known-good deployment.
3. Rotate any credential or secret that may have been exposed.
4. Revoke compromised sessions and authentication tokens when applicable.
5. Verify `/api/health`, admin login, customer login, payment flow, email flow, and the main customer dashboard after recovery.
6. Review runtime errors and firewall activity for at least one hour after recovery.

## Incident Severity
- SEV-1: Site unavailable, active compromise, payment/authentication compromise. Immediate rollback/containment.
- SEV-2: Critical API degraded, sustained abusive traffic, repeated authorization failures. Tighten protections and investigate immediately.
- SEV-3: Isolated errors or suspicious probes without service impact. Monitor and patch in normal release flow.

## Emergency Checklist
- [ ] Confirm impact and affected routes.
- [ ] Check Vercel runtime errors.
- [ ] Check Firewall denied/challenged traffic.
- [ ] Enable Attack Mode only if broad malicious traffic is confirmed.
- [ ] Roll back if a recent deployment caused the issue.
- [ ] Rotate exposed secrets.
- [ ] Re-test authentication and payment paths.
- [ ] Record root cause and preventive change.

## Security Release Gate
Before declaring a production security change complete:
- Production deployment must be Ready.
- No new critical runtime error group may be attributable to the change.
- Admin-only endpoints must reject unauthenticated requests.
- Client-only endpoints must reject unauthenticated requests.
- Login and verification endpoints must continue to rate-limit repeated attempts.
- Health endpoint and primary customer flows must respond normally.
