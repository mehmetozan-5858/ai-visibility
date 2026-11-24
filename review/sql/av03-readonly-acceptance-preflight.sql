-- AV-03 review-only preflight: SELECT-only, aggregate-only and no customer PII.
-- Run on a deliberately selected environment; counts are not session/PDF acceptance.
-- Applicant assessment evidence is in answer_evidence_runs, NOT ai_provider_comparisons.
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
  (SELECT count(*) FROM public.answer_evidence_runs r JOIN verified_pilot_matches m
     ON r.entity_id=m.prospect_id WHERE r.entity_type='prospect'
     AND r.created_at >= now()-interval '14 days') AS linked_recent_prospect_answer_runs,
  (SELECT count(*) FROM public.applicant_assessment_deliveries d JOIN verified_pilot_matches m
     ON d.lead_id=m.lead_id AND d.prospect_id=m.prospect_id) AS linked_delivery_records,
  (SELECT count(*) FROM public.applicant_assessment_deliveries d JOIN verified_pilot_matches m
     ON d.lead_id=m.lead_id AND d.prospect_id=m.prospect_id
     WHERE d.status='completed') AS completed_linked_delivery_records,
  (SELECT count(*) FROM public.ai_provider_comparisons) AS customer_comparison_records;
-- A run is NOT automatically a successful provider response; inspect its outcome separately.
-- Missing delivery records do not prove the PDF renderer or manual browser download failed.
-- No database writes, migrations, passwords, provider calls or payment changes.
-- AV-03 stays OPEN until authorized same-customer session and PDF delivery are proven.
