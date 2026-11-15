# GEO evidence integration acceptance (review only)

## Current scope
`lib/geo-evidence-contract.js` is a pure offline normalizer, **not** a production integration. Its `recorded` status means a response-shaped record has mandatory metadata; it does **not** mean the model actually returned it or the citations were checked. This must not be shown to customers as independently verified evidence.

## Before connecting to customer data
1. Map the actual producer of `answer_evidence_runs.result.observations` and its authenticated provider response metadata. Verify tenant and actor authorization before reads; never trust a client-supplied tenant or actor.
2. Define immutable run ID, response capture time, provider/model/version, prompt language, query, mode, and prompt-bias flags. Reject synthetic/demo, truncated, provider errors, stale and missing records. Do not turn failures into zero scores.
3. Apply server-side PII/secrets redaction and retention rules **before** exposing raw answer text. Restrict customer access to their own records; no public raw evidence in free assessment.
4. Citation URLs are only syntactically filtered here. Before a `verified` label, validate provenance and retrieve sources with SSRF protection, redirect checks, content-type and size limits, and a documented time-stamped verification result. Never fetch arbitrary submitted URLs from this normalizer.
5. Compute trend deltas only for compatible provider/model, query set, locale, methodology and sample windows. Otherwise show `not comparable`.
6. Show `demo`, `recorded / not independently verified`, `verified`, `insufficient evidence`, and `provider unavailable` as distinct UX states.

## Acceptance gates
- Unit tests for tenant isolation, authorization, provenance, redaction, malformed/unsafe URLs, no-citation, provider failures, and comparable vs incompatible historical runs.
- Exact-head free CI and web/mobile smoke.
- Read-only synthetic customer preview; independent human review of security/privacy and UI wording.
- Separate approval for live provider requests, customer writes, paid usage, merge or deployment.

## Source facts inspected 2026-11-06
- `app/api/free-assessment/route.js` reads `answer_evidence_runs` and exposes only aggregate assessment and business metadata after token validation.
- `lib/free-assessment-rules.js` requires >=6 qualifying samples, >=2 providers and >=2 queries within 14 days and returns null when evidence is insufficient.
- `app/demo/page.js` is an explicitly synthetic demo.
