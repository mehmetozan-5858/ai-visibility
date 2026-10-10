# Responsive portal acceptance criteria

## Screen targets
- Mobile: 320, 375, 390, 430 px; stacked content, no horizontal scroll, touch targets >=44px.
- Tablet: 768, 820, 1024 px; adaptive navigation and two-column panels where space permits.
- Desktop: 1280, 1440, 1920 px; max-width content, visible top navigation, side-by-side hero and data cards, readable tables and dashboards.

## Customer vs admin
- Public marketing: hero, solutions, methodology, sample report, contact and pricing only when operational.
- Customer portal: purchased reports, verified measurements, progress, billing; authenticated and scoped to tenant.
- Admin portal: lead finder, evidence, agent status, sales funnel, quota/cost and exceptions; restricted roles, audit logs.

## Desktop portal patterns
- Left navigation (collapsible), top toolbar (language, search, profile), KPI strip, evidence-linked lead table with filters, agent status, daily executive report.
- Tables support horizontal scrolling only within their container on narrow screens; never leak private customer data.
- Do not publish admin mockups as live features.

## Release gates
Build and type checks; screenshot review at all widths; keyboard and screen reader navigation; TR/EN switching; access controls; Vercel preview and live verification. Do not merge PR until existing routes and customer/admin screens are inventoried and regression-tested.
