# One-shot pilot comparison recording — 27 October 2026

The legacy one-shot endpoint previously inserted the comparison and updated its durable attempt in separate operations. An update failure could leave an answer behind while the attempt remained started.

The endpoint now uses storeSingleScanComparison: lock the fixed one-shot claim scoped to the authorized customer, insert the answer, update status and comparison_id, then commit together. Any failure rolls back both writes. Replaying a stored claim returns its existing comparison ID. Historical stored claims without an ID fail closed; no answer is invented and no new comparison is inserted. The claim limit is unchanged. The additive comparison_id column is prepared before any provider request, only inside the already gated POST path.

Four file-backed PGlite integration cases cover wrong customer/mismatched identity, completion failure rollback, historical stored claims without IDs, and restart persistence/idempotent replay. The full local suite passes 568 tests.

This change closes the single-scan atomicity gap described in the earlier reliability evidence. The two-task runner already has a separate atomic recorder. No real provider failure cause is established by these isolated tests. ZERA remains a customer; real scans, source checks, score and customer report acceptance remain open.

No live database schema/data changes, provider calls, attempt reset, deployment, budget change or payment were performed. Existing provider spending and deployment holds remain.
