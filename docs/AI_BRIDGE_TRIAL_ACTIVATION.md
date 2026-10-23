# AI Bridge inference activation checklist (AI Visibility Works)

State: staged in PR #90; **not active in production**.

A new `POST /api/admin-ai-bridge-trial` endpoint can invoke one allowlisted free OpenRouter model only after:
- Existing AI Visibility admin session is verified (same admin cookie as existing protected routes).
- Same-origin request check passes and the admin trial rate limit is not exhausted (2 requests/hour/IP).
- Server-only `AI_BRIDGE_INFERENCE_ENABLED=true` is deliberately configured.
- Server-only `OPENROUTER_API_KEY` is configured; never put it in browser source, GitHub or messages.
- The remote catalog reports exactly zero for both prompt and completion price at request time.

Every trial is restricted to 1 model, 350 requested output tokens, a short user prompt and a 10 second timeout. Unknown, paid or unavailable models fail closed. It does not enable 17 models simultaneously, cannot guarantee zero provider charges, and must be disabled again if billing/routing semantics change.

No `AI_BRIDGE_INFERENCE_ENABLED` or API key environment variable has been created by this PR. No API requests to OpenRouter were made. The user's existing read-only **AI Bridge MCP plugin** has NOT changed. Adding an MCP model-call tool requires updating and redeploying the separate MCP server, which is not present in accessible GitHub repositories.

To activate later: provider account with hard zero-spend controls, private key, server-side switch, a single explicit approved trial, cost verification, and disable when not needed. Do not deploy the trial route merely to make a test run. Continue AI Visibility development in the meantime.
