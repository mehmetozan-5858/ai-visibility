-- AV-03 preflight (review only). SELECT-only; aggregate counts, no IDs, emails or tokens.
-- Use on an explicitly selected environment; never count this as real session/PDF acceptance.
-- Intended to distinguish lead/email verification, active pilot mapping,
-- and provider-comparison evidence without reading customer PII.
WITH active_pilots AS (
  SELECT c.client_id, lower(c.email) AS email
  FROM public.client_credentials AS c
  JOIN public.client_pilot_access AS p
    ON p.client_id = c.client_id AND lower(p.email) = lower(c.email)
  WHERE p.revoked_at IS NULL AND p.expires_at > clock_timestamp()
), verified_links AS (
  SELECT DISTINCT a.lead_id, a.prospect_id, lower(l.email) AS email
  FROM public.applicant_assessment_links AS a
  JOIN public.customer_leads AS l ON l.id = a.lead_id
  WHERE a.revoked_at IS NULL AND a.verified_at IS NOT NULL
), verified_emails AS (
  SELECT DISTINCT lead_id, lower(email) AS email
  FROM public.lead_email_challenges
  WHERE verified_at IS NOT NULL AND consumed_at IS NOT NULL
), verified_pilot_matches AS (
  SELECT DISTINCT a.lead_id, a.prospect_id, p.client_id
  FROM verified_links AS a
  JOIN verified_emails AS e ON e.lead_id = a.lead_id AND e.email = a.email
  JOIN active_pilots AS p ON p.email = a.email
)
SELECT
  (SELECT count(*) FROM active_pilots) AS active_pilots_with_credentials,
  (SELECT count(*) FROM verified_links) AS verified_assessment_links,
  (SELECT count(*) FROM verified_links a JOIN verified_emails e ON e.lead_id=a.lead_id AND e.email=a.email) AS verified_assessment_email_links,
  (SELECT count(*) FROM verified_pilot_matches) AS verified_linked_pilot_accounts,
  (SELECT count(*) FROM public.ai_provider_comparisons) AS provider_comparison_records;
-- A positive count is not proof the signed customer session works.
-- Do NOT modify passwords, grants, DB schema, customer records or Paddle.
-- AV-03 stays open until the same applicant/client passes verified admission,
-- authorized session, linked report generation, and actual customer delivery.
