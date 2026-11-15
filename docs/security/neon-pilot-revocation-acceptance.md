# PR #273 — isolated Neon acceptance and revocation concurrency plan

**Scope:** Neon `ancient-water-34496424`, isolated branch `br-plain-poetry-b2u7f7a6` only. Production and default branch remain HOLD. This document is a test design, **not evidence of a passed test**. Never paste secrets into logs, PR comments or ChatGPT.

## Prerequisites
1. Confirm exact target branch/database and PR head SHA. Use a fresh isolated/synthetic tenant, report and pilot-access grant. Current `client_pilot_access` table has zero rows: positive testing is impossible without an isolated fixture.
2. Securely provide gateway role credentials to the test runner (do not use DB owner to substitute for the gateway role).
3. Obtain an explicit change approval and snapshot/restore plan before applying the review SQL on the isolated branch. Do not execute this SQL in production. Confirm required column-level SELECT, no direct access to signing_keys/consumed_claims, and callable function privileges after replacement.
4. Verify that the existing function remains owned by `portal_report_fn_owner_trial_20261115` and `SECURITY DEFINER SET search_path = pg_catalog`. Do not grant EXECUTE to PUBLIC.
5. The patch uses `FOR SHARE` on clients and client_pilot_access. Verify with two independent database sessions that revocation UPDATE or DELETE blocks during an authorized read, then commits after the read transaction completes. Observe statements' commit order, not just timestamps.

## Test matrix (isolation only)
| Case | Condition | Expected |
| --- | --- | --- |
| T01 | Valid signed, unexpired, unrevoked pilot claim, active tenant | Own synthetic report only and claim consumed once |
| T02 | Re-submit the same claim_id | No rows, consumed count unchanged |
| T03 | Two sessions submit the same claim_id concurrently | At most one claim inserted/successful |
| T04 | Previously signed claim after pilot revoked_at set | No rows, no claim consumed |
| T05 | Pilot expired or no pilot grant exists | No rows, no claim consumed |
| T06 | Client suspended or deleted | No rows, no claim consumed |
| T07 | Invalid MAC or expired / >300 sec expiry | No rows, no claim consumed |
| T08 | Tenant A claim used to request tenant B report | No B data |
| T09 | Gateway queries signing_keys or consumed_claims directly | Permission denied |
| T10 | Unauthorized role calls portal_trial_one_time_report | Permission denied |
| T11 | Revocation races with read in independent sessions | Serial outcome: committed revocation before read lock denies; revocation after read lock waits until read transaction finishes |
| T12 | Legacy verified_report bypass attempt | Gateway must have no EXECUTE |
| T13 | Session and portal UI with real client existing password | Separate later acceptance: not proven by SQL test |
| T14 | CI exact-head, Paddle and provider live evidence | Separate later acceptance: not proven by offline tests |

## Two-session concurrency procedure
- Provision only synthetic records on the isolated branch with a unique claim_id. Record minimal redacted trace: UTC time, git SHA, branch ID, transaction ID and expected/actual outcome.
- Session A: begin transaction, invoke report with the signed synthetic claim and keep transaction open. Session B: begin, UPDATE the same pilot row to set revoked_at, measure whether it waits.
- Commit Session A; verify Session B can now commit; Session C with a freshly signed claim must return no rows. If a revocation commits first, subsequently started claim must fail.
- Also test the reversed ordering, expired grant, deleted pilot row and client suspension. Make sure any timeout/exception fails closed. Keep short lock_timeout and statement_timeout in the harness to prevent indefinite waits.
- Confirm no other paths can issue or revoke pilot access without maintaining these invariants.

## Exit criteria
All T01–T12 pass with redacted SQL logs and exact PR head; no credentials exposed; independent approval of row-lock semantics; restore/cleanup synthetic fixture. Keep production HOLD until real customer current-password login, owned report rendering, live provider evidence, Paddle and exact-head CI have each been verified independently.
