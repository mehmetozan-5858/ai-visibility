# RD-03 increment 2: bounded real-record read

Admin-only page `/arge/gercek-olaylar` requests `GET /api/admin/rd-audit-readonly` on explicit button press. Existing proxy authentication and route-level `requireAdmin` both apply. No public-prefix exception is added.

`lib/rd-real-audit.mjs` reads only `rd_audit.real_record_summary`, a security-barrier aggregate view of the two existing event/cost tables, restricted to the last seven days and latest 200 records per source. A 201st candidate marks the sample as limited. Raw event text, identifiers, agent names, contacts, payloads and provider errors never enter the returned aggregate. Cost records are classified as estimated/unknown without claiming a verified actual total.

Every application read requires `BEGIN READ ONLY`, a 3-second statement timeout, `SET LOCAL ROLE rd_audit_reader` and confirmation that `transaction_read_only` is `on` and the effective role matches. Failure rolls back and produces a generic unavailable response, with no owner-level fallback. This path deliberately bypasses existing schema-initializing repository helpers and executes no migrations, provider requests, scheduler actions or audit writes.

An independent fixed aggregate SELECT was exercised on the existing Neon production branch. The private result is not embedded in the public repository or synthetic pilot. This proves a bounded production record read, not authenticated HTTP acceptance of the admin endpoint.

## Remaining boundary

The application still uses its existing database connection, then explicitly reduces the transaction's effective role. The dedicated `NOLOGIN` reader can read only the summary view, not the source tables or writes. The response reports `dedicatedReaderRole:true` only after effective-role verification, and `connectionRoleIsDedicated:false`: no separate login, password or separately scoped connection is claimed. A compromised application connection retains its original broader identity; this is a query-scoped role reduction, not credential isolation or a complete audit product.

## Rollback

Previous production deployment before role reduction: `dpl_EUhncwh9mDPG1oFZy96vzEH3DWbV`, source `2bbdf5456badb56ac4571dce786fc76cf419169c`. The additive one-time migration `migrations/rd-audit-reader.sql` creates a non-login role and aggregate view, but changes no customer/event rows. A code rollback may leave these inert objects in place; do not automatically drop them. Real records remain private behind existing admin authentication.
