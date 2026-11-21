import {collectFreeAnswerEvidence, freeMeasurementStatus} from './free-answer-evidence.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function selectScheduledFreePilot(pool, env = process.env) {
  const clientId = env.SCHEDULED_FREE_PILOT_CLIENT_ID;
  if (typeof clientId !== 'string' || !uuid.test(clientId) ||
      !freeMeasurementStatus(env, env.SCHEDULED_FREE_PILOT_MODEL).ready) return null;

  const tables = (await pool.query(`SELECT to_regclass('public.client_pilot_access') AS pilot,
    to_regclass('public.client_profiles') AS profiles`)).rows[0];
  if (!tables?.pilot || !tables.profiles) return null;

  const entity = (await pool.query(`SELECT c.id,c.name,c.domain,btrim(cp.sector) AS sector,btrim(cp.city) AS city,btrim(cp.country) AS country
    FROM public.clients c
    JOIN public.client_profiles cp ON cp.client_id=c.id
    JOIN public.client_pilot_access pa ON pa.client_id=c.id
    WHERE c.id=$1 AND c.status='active'
      AND pa.revoked_at IS NULL AND pa.expires_at>NOW()
      AND btrim(cp.sector)<>'' AND (btrim(cp.city)<>'' OR btrim(cp.country)<>'')
      AND NOT EXISTS (
        SELECT 1 FROM public.answer_evidence_automation_slots s
        WHERE s.entity_id=c.id AND s.entity_type='client' AND s.kind='pilot-first'
          AND s.created_at>NOW()-INTERVAL '24 hours'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.answer_evidence_runs r
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.result->'observations')='array' THEN r.result->'observations' ELSE '[]'::jsonb END) AS item
        WHERE r.entity_id=c.id AND r.entity_type='client'
          AND r.result->>'automationKind'='pilot-first'
          AND r.result->>'measurementPolicy'='verified-zero-price-only'
          AND item->>'provider'='OpenRouter' AND item->>'mode'='openrouter-free-api-no-search'
          AND item->>'model' LIKE '%:free' AND btrim(item->>'responseId')<>''
          AND item->'usage'->'cost'->'total_cost'='0'::jsonb
          AND item->'truncated'='false'::jsonb AND item->'brandPrompted'='false'::jsonb
          AND btrim(item->>'query')<>'' AND btrim(item->>'text')<>''
      )`, [clientId])).rows[0];
  if (!entity) return null;

  return {
    entity: {...entity, entityType: 'client'},
    kind: 'pilot-first',
    options: {
      language: /^(Türkiye|Turkey|TR)$/i.test(entity.country) ? 'tr' : 'en',
      automationKind: 'pilot-first',
      measurementOrigin: 'scheduler',
    },
    collect: (customer, options) =>
      collectFreeAnswerEvidence(customer, options, {env, model: env.SCHEDULED_FREE_PILOT_MODEL}),
  };
}
