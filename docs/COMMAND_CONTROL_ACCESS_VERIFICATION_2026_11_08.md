# Command control access verification

## Confirmed connection boundary
The current Neon connection resolves the existing free-plan project `ancient-water-34496424`, production branch `br-cool-cherry-b2r912on`. No new paid resource was created.

The query session reports transaction_read_only=on while default_transaction_read_only=off. The owner has schema CREATE privilege. The previous inference that this SELECT result alone proved the entire account read-only was too broad.

Actual supported-capability checks:
- `create_branch`: unavailable from the connected server's tools/list; no branch created.
- `run_sql_transaction`: unavailable from tools/list; no transaction executed.
- `run_sql` with a temporary table that would disappear at commit: rejected, `cannot execute CREATE TABLE in a read-only transaction`, SQLSTATE 25006; no table created.
- AI Bridge: online, inference disabled, read-only tools only.

The installed Neon plugin was discovered and is enabled; reinstalling it or changing a ChatGPT confirmation preference is not proof of writable OAuth/tool scope. No privileged connection string was retrieved to work around this boundary.

## Implemented improvement
Shared snapshots no longer require an exclusive table lock. They use a read-only transaction and one committed ledger query; a SELECT-only database credential can read the authorized projection. Writers use a transaction advisory lock and require only SELECT/INSERT on the ledger. UPDATE, DELETE, schema creation and access to customer tables are not required.

`AGENT_COMMAND_READ_DATABASE_URL` can be provided separately from the writer URL. Admin scope remains selected by the trusted registry and `AGENT_COMMAND_ADMIN_ACTOR_ID`; request parameters cannot choose a tenant or actor. A missing writer does not prevent a configured reader from inspecting history.

`migrations/agent-command-access.sql` prepares NOLOGIN permission groups. It issues no password, service login, customer entitlement or agent token. It has not been applied to production.

PostgreSQL-engine role tests validate SELECT-only reads, denied append by readers, append/review by writers, denied UPDATE/DELETE and denied reads of unrelated private tables. Production role provisioning and multi-client distributed lock behavior remain open.
