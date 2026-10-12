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
`vercel.json` explicitly contained `git.deploymentEnabled: false`. PR #19 changed the setting to `true` and passed the Node 24 CI/test/build pipeline before merge.

## Authorization repair and final probe
- Post-fix pushes still produced no deployment while the GitHub installation reported restricted repository access.
- The repository access for the Vercel GitHub App was reviewed by the owner.
- Verification commit: `0cae733392045059d1e21fedffd8567437061a81`.
- Vercel automatically created production deployment `dpl_5NadLYG8qqiUK5GiAGSHYURRKoQB` from that exact SHA without a manual deployment API call.
- The deployment reported `source: git`, reached `READY`, and was mapped to both `aivisibilityworks.com` and `www.aivisibilityworks.com` without alias errors.

Result: automatic GitHub -> Vercel production release path is verified operational.
