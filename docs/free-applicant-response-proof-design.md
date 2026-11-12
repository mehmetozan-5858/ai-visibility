# Free applicant response proof — design review (NOT shipped)

## Existing state (2026-11-12)
- `answer_evidence_runs` stores run metadata and JSON observations.
- `cost_ledger` stores generic provider cost rows, with `prospect_id` nullable, `metadata` JSON, numeric amount and estimated flag.
- `recordOperationalCost` currently writes a zero-USD receipt **before** an observation is appended, but does not persist a direct `responseId`, `runId`, or reliable per-observation linkage in the cost ledger.
- `freeAssessmentEvidence` counts provider/query observations without joining to individually verified cost receipts.
- Consequently a historical zero-cost row and a matching-looking JSON observation **must not** be treated as cryptographic or transactional proof that a specific output was free.

## Proposed future design, no migration or integration in this PR
1. Define a durable per-response evidence record with server-generated `run_id`, `observation_id`, `tenant_id`, `domain`, `provider`, `model`, `response_id`, neutral `query` hash, provider-reported exact cost/currency, trusted verification state, request time and complete/finish state. Use server-side tenant/actor identity only.
2. Save receipt and associated eligible observation atomically, or make the failed association ineligible. Database transaction boundaries and rollback behavior must be tested using a temporary synthetic database.
3. Verify exact provider/model/response identity and provider's actual billing/pricing evidence, rejecting estimated, missing, nonzero, cross-tenant, duplicate, paid or unknown cases. A zero-value input provided by the browser is not trusted evidence.
4. Include `run_id` and evidence references in result reads. Load receipts by precise server-side references before scoring, with no fallback to legacy unlinked observations.
5. Explicitly classify old runs as `historical-unlinked`, never silently backfill them as verified.
6. Preserve free-only provider caps and fail closed on quota, unknown pricing, privacy restrictions, or missing consent. No automatic retries, paid fallback, checkout, live deployment or new provider requests.
7. Cover tenant isolation, races, response retries and duplicate idempotency; update iPhone/desktop synthetic acceptance. Verify against actual production schema **read-only** before authorizing migrations.

## Safety status
The adjacent `free-applicant-proof-policy.mjs` is only an isolated proposal. It is not connected to production scoring, does not attest that its arguments originate from trustworthy records and does not authorize inference. Project billing/free-tier eligibility and consent remain unknown.

Related: Issue #260 and PR #261. Any database migration or actual provider integration requires separate reviewed release approval.
