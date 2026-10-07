import {answerPool} from './answer-evidence-store';
import {summarizeDailyAnswerEvidence} from './answer-evidence-daily-rules.js';
import {validReportDate} from './reporting';
export async function dailyAnswerEvidence(date,deps={}){
 if(!validReportDate(date))throw Error('invalid-report-date');
 const pool=deps.pool||await answerPool();
 const rows=(await pool.query(`SELECT id,entity_type AS "entityType",entity_id AS "entityId",entity_name AS "entityName",created_at AS "createdAt",COUNT(*) OVER() AS "totalRuns",
 (result-'observations')||jsonb_build_object('observations',(SELECT COALESCE(jsonb_agg(x-'text'-'citations'-'usage'),'[]'::jsonb) FROM jsonb_array_elements(COALESCE(result->'observations','[]'::jsonb)) x)) AS result
 FROM answer_evidence_runs WHERE created_at>=($1::date::timestamp AT TIME ZONE 'Europe/Istanbul') AND created_at<(($1::date+1)::timestamp AT TIME ZONE 'Europe/Istanbul') ORDER BY created_at DESC,id LIMIT 1001`,[date])).rows;
 return {...summarizeDailyAnswerEvidence(rows.slice(0,1000)),date,totalRuns:Number(rows[0]?.totalRuns||0),limited:rows.length>1000};
}
