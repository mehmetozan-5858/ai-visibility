# Data model

## Client
id, name, domain, plan, status, visibilityScore, competitors

## Scan
id, clientId, queries, status, createdAt

## AgentJob
id, agent, type, payload, status, createdAt, requiresApproval

## Future persistent entities
Subscription, ProviderResult, VisibilityMention, CompetitorMention, Approval, DailyReport, Lead, OutreachDraft.
