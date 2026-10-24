# AI Visibility launch database integration gate (not deployed)

The existing `docs/DATA_MODEL.md` describes Client, Scan and AgentJob as a conceptual model, **not** proof of a PostgreSQL `clients(id UUID)` table. The draft SQL in this PR therefore must not be executed as-is.

## Preflight before any migration
1. Determine the live persistence provider, migrations directory, and actual client primary key type.
2. Verify whether client identifiers are UUID, text, or an application-only identifier; update both SQL foreign keys accordingly.
3. Confirm server-side signed session maps to the same tenant identity, including pilot customers.
4. Review RLS policies and application DB roles: never trust browser-provided tenant IDs or user-settable PostgreSQL session settings.
5. Test cross-tenant read/write rejection, expired/revoked service access, and sensitive consent revocation with an isolated disposable database.
6. Confirm retention/redaction for audit logs and sensitive recruitment/voice metadata.
7. Obtain separate approval before applying migrations or activating any new service.

## Deployment gate
- PR #90: service planning and authorization preparation.
- PR #91: free-model price guard; no inference activated.
- PR #92: entitlement expiry and revocation validation.
- PR #93: prospective storage and offline previews.
- Merge/rebase order and CI should be reviewed before combining these branches.
- No production changes, API keys, paid inference, outbound communication, or customer-data reads in this PR.
