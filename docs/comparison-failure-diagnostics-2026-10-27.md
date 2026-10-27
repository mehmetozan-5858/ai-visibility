# Comparison attempt diagnostics

Production source was re-read at main 532ef879660a44f993af8451588f962918d6b7ae.
The pilot runner catches comparison/storage/status failures without exposing
their stage. A recent production log query returned no matching errors; a
one-day query was rejected by log retention. Neither proves the storage root
cause. No provider request, production database query/write or retry occurred.

The staged combined candidate now records one static diagnostic for the
provider-processing, comparison-storage or attempt-status stage. PostgreSQL
codes distinguish missing schema/column, missing customer reference, missing
permission, timeout and connection failure. Unknown codes remain internal-error.
No message, detail, SQL, connection string, provider key, customer identity or
answer is logged/reflected. A failure still stops the loop and forbids automatic
retry; existing spend hold, confirmation and maximum-call controls are intact.

This is diagnostic preparation, not a fix proven against the prior production
incident. No additional provider call should be made merely to populate a log.
Production integration requires separate release review, including reconciliation
of this candidate's hold with the operator-approved production pilot settings.

Local suite: 552 tests passed. Two new tests cover static classifications and
non-reflection of private error payloads/unknown inherited property names.
Build and exact-head remote results are recorded in issue #133.
