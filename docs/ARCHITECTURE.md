# Architecture V1

## Agent roles
1. Research Agent — discovers markets, competitors and prospects.
2. Visibility Agent — schedules and records GEO/AEO checks.
3. Content Agent — drafts recommended improvements.
4. Sales Agent — prepares leads and outreach drafts; external sending remains gated.
5. CEO Agent — summarizes KPIs, anomalies and approvals.

## Safety gates
External messages, billing changes, paid campaigns and destructive actions require explicit configuration/approval. API secrets must never be committed to the repository.

## Next milestones
- Persistent database and authentication
- Provider adapters for supported AI/search sources
- Customer onboarding and scan definitions
- Billing integration
- Scheduled scans and daily executive reports
- Observability, retries and cost limits
