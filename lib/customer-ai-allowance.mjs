import {databasePool} from './database-runtime';
import {getDatabaseUrl} from './db';
import {assessPilotBudget} from './customer-ai-budget.mjs';
/** Atomic allowance reservation. Conservative estimate, NOT provider-side billing limit. */
export async function reservePilotAiAllowance({pilotId,providerCount}){
 const assessment=assessPilotBudget({requests:providerCount});
 const url=getDatabaseUrl();
 if(!url)throw Error('Persistent budget ledger unavailable');
 const pool=databasePool(url);
 await pool.query(`CREATE TABLE IF NOT EXISTS ai_pilot_allowances(
 pilot_id TEXT PRIMARY KEY, reserved_cents INTEGER NOT NULL DEFAULT 0,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
 const row=(await pool.query(`INSERT INTO ai_pilot_allowances(pilot_id,reserved_cents)
 VALUES($1,$2) ON CONFLICT(pilot_id) DO UPDATE
 SET reserved_cents=ai_pilot_allowances.reserved_cents+EXCLUDED.reserved_cents,updated_at=NOW()
 WHERE ai_pilot_allowances.reserved_cents+EXCLUDED.reserved_cents <= $3
 RETURNING reserved_cents`,[pilotId,assessment.requiredCents,assessment.budgetCents])).rows[0];
 if(!row)return {allowed:false,reason:'pilot-reservation-exhausted'};
 return {allowed:true,reservedTotalCents:row.reserved_cents,budgetCents:assessment.budgetCents,hardCap:false};
}
