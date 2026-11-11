# RD-03 increment 2: bounded real-record read

Admin-only page `/arge/gercek-olaylar` requests `GET /api/admin/rd-audit-readonly` on explicit button press. Existing proxy authentication and route-level `requireAdmin` both apply. No public-prefix exception is added.

`lib/rd-real-audit.mjs` uses a fixed SQL projection of the two existing event/cost tables, restricted to the last seven days and latest 200 records per source. A 201st candidate marks the sample as limited. Raw event text, identifiers, agent names, contacts, payloads and provider errors never enter the returned aggregate. Cost records are classified as estimated/unknown without claiming a verified actual total.

Every application read requires `BEGIN READ ONLY`, a 3-second statement timeout and confirmation that `transaction_read_only` is `on`. Failure rolls back and produces a generic unavailable response. This path deliberately bypasses existing schema-initializing repository helpers and executes no migrations, provider requests, scheduler actions or audit writes.

An independent fixed aggregate SELECT was exercised on the existing Neon production branch. The private result is not embedded in the public repository or synthetic pilot. This proves a bounded production record read, not authenticated HTTP acceptance of the admin endpoint.

## Remaining boundary

The application still uses its existing database connection. A dedicated minimally privileged database login/role has **not** been provisioned. The response explicitly reports `dedicatedReaderRole:false`; do not describe this increment as database-role isolation or a complete audit product.

## Rollback

Previous production deployment: `dpl_4W5NHQ3pmqdNJ5CbaqfiKk93sb3X`, source `697a156e200178e59381d70c8aa6307a8058951e`. This increment creates no persistent rows or schema needing cleanup. Real records remain private behind existing admin authentication.
