# Customer model: ZERA is a customer

ZERA is the primary pilot customer of AI Visibility. It is not an application
module, system actor, agent, administrator, provider, or identity authority.
Its existing customer ID, Pilot plan and explicit permissions remain the basis
of its data scope. Do not create a second account or elevate access to implement
this distinction. This checkpoint does not alter the live customer record.

## Shared product flow

All customers use the same provider-comparison engine, persisted
`ai_provider_comparisons.client_id` scope, sanitized view and customer panel.
The signed customer session selects the customer. Request query strings cannot
choose another customer. Normal active paid/pilot access permits reading that
customer's own recorded answers; it does not grant admin or Ar-Ge service rights.

`GET /api/client-provider-results` reads stored comparisons for that session.
The shared reader issues SELECT statements only and never creates the comparison
table. Existing account/access loaders retain their pre-existing initialization
behavior; this change does not add a migration or a scan to the new reader.

The customer panel's Scans section now includes recorded provider answers even
when there is no completed/scored scan. Answers, source support and visibility
scores remain separate. Empty/unverified/paused results never create a score.
Provider calls, customer email and report delivery are not triggered by reading
the panel. Source/cost release gates remain unchanged.

The old admin-only `/musteriler/zera` and `/api/clients/zera-*` paths are retained
as pilot-operation adapters. They do not make ZERA an administrator or create
product services named after it. The old `projectZeraResults` name is only a
compatibility export of the shared customer projection.

## Verification

- Complete Node suite: 549 passed, 0 failed, 0 skipped.
- Real local PostgreSQL customer-reader subset: 5 passed. Two separate synthetic
  customer UUIDs prove no cross-customer fallback; invalid scope and unbounded
  reads are rejected; source errors remain errors; all reader queries are SELECT.
- Local production HTTP smoke: 18 assertions passed. The new route rejects
  anonymous and admin-only sessions and rejects a clientId query selector.
- Optimized Next.js production build passes. React review covers abortable
  fetching, language changes, stable result keys, bounded records, accessible
  loading/error states and wrapping layout; the new component does not use
  global static-text translation on stored customer answers.
- Browser fixture script is prepared for Turkish 390px and English 1280px, but
  **did not run**: no Chromium binary was installed and the browser download
  returned an invalid/truncated archive. Mobile, visual and real customer
  acceptance are not claimed. The script uses API fixtures rather than real
  customer data; it must not be described as a complete provider/DB browser flow.

No production configuration, live customer data, provider execution, billing or
deployment changed. Real three-provider ZERA scans, independent evidence and
accepted customer reports remain pending under the existing release gates.
