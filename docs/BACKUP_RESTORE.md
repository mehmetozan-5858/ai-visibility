# AI Visibility — Backup & Restore Runbook

Updated: 2026-10-12

This runbook separates three recovery layers. A source-code rollback is not a database backup, and a database export is not a deployment rollback.

## 1. Source and application recovery

- Canonical source: GitHub repository `mehmetozan-5858/ai-visibility`.
- Production branch: `main`.
- Every commercial release must correspond to an immutable Git commit SHA.
- Vercel production deployments must retain the Git commit SHA in deployment metadata.
- If an application release is bad but the database is healthy, prefer a Vercel rollback to a previously verified production deployment rather than modifying production data.
- After rollback, verify the apex/www aliases, customer login, one read-only admin/status endpoint, and grouped runtime errors.

## 2. Production database backup

Production data is PostgreSQL/Neon-backed. Database backup evidence must be provider- or PostgreSQL-level evidence; application screenshots are not backups.

Before commercial launch, record the following without storing credentials in Git:

- [ ] Backup mechanism/provider identified (provider point-in-time restore and/or PostgreSQL logical export).
- [ ] Backup retention period recorded.
- [ ] Backup frequency/RPO recorded.
- [ ] Restore target and responsible operator recorded.
- [ ] At least one backup creation/export is verified by timestamp/identifier.
- [ ] At least one isolated restore or readback verification is completed.

### Logical export fallback

When provider-managed backup evidence is unavailable, an operator with direct database access may create an encrypted logical export using `pg_dump` from a trusted environment. Never place the database URL or dump in the repository, GitHub Actions logs, issue comments, chat, or a public artifact.

Example operator workflow (credentials supplied only through the operator's protected environment):

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > ai-visibility-YYYYMMDD.dump
```

Store the dump in encrypted private storage with access restricted to recovery operators.

### Restore verification

Restore to an isolated non-production database. Do not overwrite production merely to test a backup.

```bash
createdb ai_visibility_restore_check
pg_restore --no-owner --no-acl --dbname "$RESTORE_DATABASE_URL" ai-visibility-YYYYMMDD.dump
```

Then verify representative tables/readbacks, for example counts and latest timestamps for core customer, payment, prospect/outreach, scan/report, and agent-event data. The exact table list may evolve; use schema inspection rather than assuming a stale list.

A restore verification passes only when:

1. restore completes without fatal errors;
2. expected core tables exist;
3. representative counts/timestamps are plausible and non-corrupt;
4. no restored environment can send production email, charge payments, or call paid providers accidentally.

## 3. Secret and configuration recovery

- Vercel environment secrets are configuration, not source code.
- Never copy secret values into this document.
- Maintain only the required variable names and purpose in `.env.example`.
- A recovery rehearsal must verify that the required production variables exist in the correct environment without exposing their values.
- Rotation of a compromised secret is preferred over restoring an old secret from a backup.

## Recovery order

1. Determine whether the incident is application code, data, configuration/secret, or an external provider outage.
2. Stop or disable only the affected write path if continued writes could worsen the incident.
3. For code-only regressions, roll back the deployment.
4. For data corruption, preserve evidence and restore to an isolated database first; validate before any production cutover.
5. For credential compromise, rotate credentials and redeploy; do not restore compromised credentials.
6. Re-enable scheduled work gradually and check duplicate-suppression/idempotency controls.
7. Verify customer access, payment state, email suppression rules, scheduler health, and runtime errors.

## Launch status

This runbook documents the recovery procedure, but **database backup/restore remains a launch blocker until provider-level backup creation and an isolated restore/readback have been verified**. Documentation alone must not be used to mark the backup gate complete.
