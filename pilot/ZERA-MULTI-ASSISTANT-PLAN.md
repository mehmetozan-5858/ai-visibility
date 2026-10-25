# ZERA pilot — multi-assistant review protocol
Date: 2026-10-24
Bridge status checked: ONLINE, inference DISABLED; read-only catalog only. Catalog showed 17 zero-priced model IDs; free listing does not guarantee availability.

## Safety architecture
- ChatGPT remains orchestrator; assistant delegates only through a reviewed, opt-in inference adapter if available later.
- AI Bridge must remain isolated from GitHub production writes, live customer accounts, keys and full personal data.
- Input to delegates: scrubbed public facts, code excerpts without secrets and anonymized tasks only.
- No automatic inference calls today. No fabricated model results, no calls to paid fallback models.
- Each review has model/version, prompt version, time, claims, source evidence, error result and cost ceiling.
- Multi-assistant opinions cannot substitute real provider scan evidence or merchant-confirmed sales.

## Work allocation (pending inference capability)
1. cohere/north-mini-code: code audit of pilot integration with Next.js app.
2. nvidia/nemotron-3.5-lightning: review audit task sequence, consent boundaries and failure handling.
3. google/gemma-4-26b-a4b-it: German/Turkish phrasing and content recommendations.
4. nvidia/nemotron-3.5-super-vl: public image/product presentation audit if modality verified.
5. thinkingmachines/inkling: independent evidence/claim quality checks.

## Activation checklist
- Verify inference is expressly enabled; test a harmless no-data prompt and record success/failure.
- Confirm per-model zero price, rate limits, supported data retention and model capability at invocation.
- Establish user-approved budget threshold of €0; on any paid fallback or unexpected charge, stop.
- Add isolated asynchronous queue only after permission, cost and timeout gating are verified.
- Never expose tokens in logs or PRs.
- Keep separate from ZERA outbound reporting workflow.
## Current truth
All delegated model tasks status: BLOCKED (bridge read-only). Work continues with main assistant and existing GitHub CI.
