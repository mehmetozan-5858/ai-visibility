# Release Path Probe

Purpose: verify that harmless documentation-only changes on `main` automatically create a Vercel production deployment through the repository's Git integration.

Date: 2026-10-12

## Initial probe
- Vercel project `ai-visibility` was re-confirmed as linked to `mehmetozan-5858/ai-visibility` with production branch `main`.
- A documentation-only commit was pushed to `main` (`94c2e742e167e615227525c65ca2f801908e997d`).
- Repeated Vercel deployment lookups for that exact SHA returned no deployment.
- GitHub combined status for that SHA contained no Vercel status.
- Vercel project event history showed recent production releases were created explicitly rather than by an automatic Git push trigger.

## Root cause
`vercel.json` explicitly contained:

```json
"git": {
  "deploymentEnabled": false
}
```

Vercel documentation states that this disables Git-triggered deployments even when the GitHub repository remains linked.

PR #19 changed the setting to `true` and passed the Node 24 CI/test/build pipeline before merge.

## Post-fix probes
- A harmless post-fix `main` push still produced no automatic Vercel deployment while the GitHub installation reported restricted repository access.
- GitHub App repository access was then reviewed by the owner.
- This documentation-only update is the next verification probe after that review.

Pass condition: Vercel must automatically create a deployment for the exact commit SHA produced by this change, without using the manual deployment API.
