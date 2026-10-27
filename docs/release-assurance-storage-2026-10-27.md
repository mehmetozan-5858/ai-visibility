# Release Assurance source-to-audit acceptance — 27 October 2026

The existing GitHub collector was not connected to the persistent authorized report path. This change adds a release report path using the existing membership, entitlement, tenant lock, daily limit and atomic report/audit transaction. Revenue reconciliation continues to use its existing scoped ledger path.

The new POST /api/client-release-preview shares the production handler. It requires the signed customer session, server-authorized access, same origin, bounded JSON containing requestId only, and all three server flags ARGE_REPORT_PREVIEW_ENABLED, ARGE_AUDIT_SERVICE_ENABLED and ARGE_RELEASE_PREVIEW_ENABLED. Target and rollback commits come only from ARGE_RELEASE_TARGET_SHA and ARGE_RELEASE_ROLLBACK_SHA. No flags were enabled or deployed.

The collector always reads the fixed public AI Visibility repository, verifies exact-commit GitHub Actions checks and rollback identity, and fails closed on truncation/source errors. Membership and entitlement are checked before GitHub requests or replay. Check failures can be saved as blocked review reports; HTTP/source failures roll back. Report and audit persist together. Cross-kind request-ID reuse is rejected. Replay returns the original historical snapshot, not a fresh assessment of later commits.

## Evidence

573 local Node tests passed, including five new integration cases for persistence/restart, tenant and revoked access, GitHub/audit rollback, cross-kind replay and the release handler's flag/input boundary. Fixture tests do not establish live customer readiness.

A separate explicit CLI acceptance used the real public GitHub API and an isolated temporary file-backed PostgreSQL database. It verified the already-tested historical candidate c7b97c41624a3da4a5cfc1cf5aecbe6873a83709 against rollback 532ef879660a44f993af8451588f962918d6b7ae. It then reopened storage, replayed without another collection, and denied replay after entitlement revocation:

```json
{"ok":true,"scope":"live-public-github-to-isolated-postgres","subjectSha":"c7b97c41624a3da4a5cfc1cf5aecbe6873a83709","rollbackSha":"532ef879660a44f993af8451588f962918d6b7ae","checks":[{"name":"build","passed":true,"reason":"passed","checkId":122409133019},{"name":"web-mobile-smoke","passed":true,"reason":"passed","checkId":122409132450}],"provenance":{"sourceUrl":"https://api.github.com/repos/mehmetozan-5858/ai-visibility/commits/c7b97c41624a3da4a5cfc1cf5aecbe6873a83709/check-runs?per_page=100&filter=latest","capturedAt":"2026-10-27T20:15:25.874Z","repository":"mehmetozan-5858/ai-visibility","rollbackUrl":"https://api.github.com/repos/mehmetozan-5858/ai-visibility/commits/532ef879660a44f993af8451588f962918d6b7ae"},"auditCount":1,"restartReplayVerified":true,"revokedReplayDenied":true,"productionStorageTouched":false,"deploymentAuthorized":false}
```

This proves real GitHub metadata -> authorized report -> persistent audit in isolated storage. It does not prove production migration/configuration, current candidate checks, real provider delivery, Revenue Integrity's actual subscription/usage/invoice source integration, or all-product release readiness. The CLI creates only temporary synthetic membership/grant records; it never uses configured customer storage.

No deployment, production setting/schema/data write, provider call, payment, budget change or customer delivery occurred. deploymentAuthorized and customerDeliveryAuthorized remain false. ZERA stays a customer. DPP/EUDR/PPWR/CBAM/UK Compliance remain excluded.
