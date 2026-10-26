# AI Bridge inference — release hold and future activation checklist

**Current state (26 October 2026): HARD DISABLED / NOT RELEASED.**
This document describes prerequisites for a possible future, separately approved trial. It is **not** an activation guide for the current branch or production.

## Current behavior in the stacked draft launch branch

- `lib/ai-bridge-release-hold.mjs` always returns `allowed: false` with `inference-release-not-approved`.
- `POST /api/admin-ai-bridge-trial` requires the existing admin session and same-origin checks, then refuses inference **before** reading request JSON, a provider key, rate-limit state, or invoking an adapter.
- `runFreeBridgeTask` independently enforces the same non-configurable hold before any model catalog or completion transport.
- `GET /api/admin-ai-bridge-trial` reports `releaseApproved: false` and `configuredForTrial: false`.
- Neither `AI_BRIDGE_INFERENCE_ENABLED=true`, a configured `OPENROUTER_API_KEY`, an allowlisted `:free` model, nor a zero-priced catalog entry can bypass this hold.
- The external AI Bridge MCP connection remains read-only. It has **no enabled inference capability**. This PR does not register MCP tools, perform real inference, or approve spend.

The hard hold is staged in draft PRs #136, #137 and the integrated draft #138, layered on #90. **None of these drafts is a production release.** Do not merge or deploy them automatically.

## Future trial requirements — NOT authorized or implemented as a release

A later release would require a separate reviewed code change removing the hard hold, plus explicit owner approval and all of the following:

1. Verify the existing admin session, same-origin request, rate limits (currently designed for 2 requests/hour/IP), and a single allowlisted model.
2. Obtain a provider-issued **server-side** credential without exposing it in GitHub, browser source, chat or logs.
3. Establish enforceable provider-side zero-spend/billing controls; the `:free` label and a zero-price catalog response alone **do not guarantee zero charges**.
4. Revalidate catalog pricing for prompt, completion and ancillary charges; keep strict prompt/output limits (currently designed for 350 output tokens and a 10-second timeout).
5. Run offline security/regression tests, review the deployment configuration and get separate approval before any real request or production release.

No key, paid service, inference call, payment, external customer message, main merge or Vercel production deployment is authorized by this document.

## Historical read-only environment observation (24 October 2026)

A previous inspection of the `ai-visibility` Vercel project's environment-variable **names** found neither `OPENROUTER_API_KEY` nor `AI_BRIDGE_INFERENCE_ENABLED`. This was a point-in-time observation, **not a current environment guarantee**. The non-configurable release hold above remains necessary regardless of later environment changes.
