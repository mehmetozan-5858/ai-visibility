# Combined audit request and storage verification

The existing customer preview route now composes a shared server handler.
Next still obtains the cookie with its server cookie API and verifies the
existing signature. Flags, account/access resolution and database pool remain
server dependencies; none are taken from request JSON. No test mode, bypass,
fixture endpoint or new production flag was added.

The shared handler was exercised over actual loopback HTTP with the existing
client token signing/verifying functions and a file-backed PGlite PostgreSQL
database. Fixture account/pilot lookups substitute for live customer records;
the real tenant policy, membership/grant/ledger repository and transaction run.
The test checks tampered cookies, forbidden tenant selectors, exact difference
amounts, report plus audit persistence, another tenant without a grant, storage
close/reopen with idempotent replay and grant revocation blocking replay.

This closes the gap between separate HTTP-boundary and database tests for this
isolated report-preview flow. It is not a deployed database, real billing feed,
customer delivery, provider scan or all-module acceptance. Provider holds and
the default-disabled preview flags are unchanged. ZERA remains a customer.

Local validation: combined HTTP/PostgreSQL test passed; Next production build
passed. Exact-head remote CI is recorded in issue #133. The existing production
server smoke separately verifies Next/proxy/cookie request boundaries.
