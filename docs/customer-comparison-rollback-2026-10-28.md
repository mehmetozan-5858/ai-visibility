# ZERA comparison storage: failed rollback cleanup

Review candidate based on #154 at `f8a72019ab2236abb14c9b11336761d36256062a`.

Both the queued pilot task and legacy one-shot writer previously swallowed a
ROLLBACK error and returned the pooled connection normally. They now discard
that connection with `release(true)`, preserving the original operation error.
Successful commits and rollbacks still release normally. No retry, claim reset,
schema migration, provider execution or production write is introduced.

Validation in this session:

- 583 Node tests passed, including ten new transaction cleanup regressions.
- Existing isolated SQL tests verify atomic answer/attempt persistence, rollback,
  replay after restart and customer isolation; 20 storage tests passed together.
- Production build passed after this change; `git diff --check` passed.
- Remote CI on the new commit remains to be inspected separately.

## Unresolved acceptance

The historical ZERA provider failure has no recorded detailed reason and remains
unexplained. #154 deliberately holds provider execution pending verified
provider-side cost enforcement and release approval. Passing synthetic and
isolated SQL tests does not prove a real three-provider scan, ranking score,
customer report delivery or live payment acceptance. ZERA is a customer, not an
administrator. The candidate remains separate from main and production.
