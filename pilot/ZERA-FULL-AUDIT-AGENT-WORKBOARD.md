# ZERA Pilot — Evidence-led audit and agent workboard
Date: 2026-10-24
Pilot: ZERA-DE-001
State: Public-scope written approval recorded by owner. No private-account or sales-data consent.

## Confirmed observations
- Wetzlar-Naunheim clothing store listing at Wetzlarer Str. 47, 35584 Wetzlar, Germany; third-party listing retrieval displays ~4.9/5 across 46 reviews. Re-check before external publication.
- User-provided Instagram screenshots: 3,575 followers and 142 posts as of 2026-10-24. Not API-verified.
- Public results contain unrelated similarly named ZERA retailers; sample https://www.zeraxclusive.com/. No evidence of actual customer loss or misrouting.
- No independently verified company-owned website, merchant product feed, Google Search Console ownership, Meta Insights, sales records, conversion events or AI-engine mention baseline.

## Agent assignment backlog (read-only by default)
| ID | Agent | Task | Priority | Evidence / completion condition | Allowed now |
|---|---|---|---|---|---|
| Z01 | Brand Identity Agent | Map variants ZERA, ZERA Clothing, Wetzlar; distinguish unrelated brands | P0 | Dated search results, grounded identity list, ambiguity matrix | Yes (public) |
| Z02 | Local Search Agent | Audit Google Business name/category/location/contact/hours against public evidence | P0 | Listing links, dates, contradictions or unknown flags | Yes (public) |
| Z03 | GEO/AEO Agent | Test fixed German and Turkish prompts in connected AI providers | P0 | Raw provider responses, timestamps, engine/model, query and source | Only when configured |
| Z04 | SEO Agent | Verify official website, indexing, canonical tags, structured data, mobile, performance | P1 | Domain ownership confirmation then URL-level audit | Public scan after domain confirmation |
| Z05 | Social Agent | Review public Instagram biography, descriptions, captions and inbound paths | P1 | Post URLs, dated observations, improvement drafts | Public read-only |
| Z06 | Competitor Agent | Find local boutiques competing on the exact relevant queries | P1 | Query-based competitor IDs and comparative evidence | Yes (public) |
| Z07 | Merchandising Agent | Catalog completeness, product descriptions, sizes and prices | P1 | Approved catalog/public links and missing fields | Only public product pages |
| Z08 | Conversion Agent | Propose tagged attribution links and lead funnel | P1 | UTM plan, validation, no live installation | Draft only |
| Z09 | Reporting Agent | Produce evidence/unknown-separated baseline and 30-day plan | P0 | Source-backed report with no synthetic data | Yes |
| Z10 | Quality Agent | Check every claim against source and consent scope | P0 | Pass/fail evidence and permissions checklist | Yes |

## Critical blockers / gates
1. Current pilot module is in draft PR #98, not merged or deployed; no active agent runner.
2. Provider-level scans cannot be marked completed without actually invoking configured search adapters; no demos or unsupported SEO rankings.
3. Firm approval allows public-information analysis, not edits to Instagram, Google listings, the website or real customer outreach.
4. Ask merchant to verify official website/domain and Google listing before editing identity or catalog materials.
5. Conversion measurement requires consented installation of a tag/link and merchant-confirmed aggregated order attribution; no private customer records by default.
6. Avoid legal/regulatory advisory product features in this pilot; site compliance questions can be separately escalated to the merchant, not automated as legal advice.
7. No paid providers, email sends, account modification or production deployment without explicit owner approval.

## Suggested execution order
Phase A: Z01/Z02/Z06 public evidence and Z09 baseline.
Phase B: Z03 engine integrations; Z04/Z05/Z07 actionable audits.
Phase C: Z08 drafts + merchant approval; Z10 gates each proposed change.
Phase D: approved changes and 30-day before/after reports using merchant-verified outcomes.

## Definition of Done
All audit findings are source-linked, dated, confidence-tagged, and distinct from recommendations. Every fix has an owner agent, approval gate, test and measurable outcome. Unknown metrics remain unknown.
