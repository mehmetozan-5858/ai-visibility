import crypto from "node:crypto";
import {databasePool,initializeSchema} from './database-runtime';
import {getDatabaseUrl} from './db';
async function pool(){
 const p=databasePool(getDatabaseUrl());
 await initializeSchema(p,'pilot-access',tx=>tx.query(`CREATE TABLE IF NOT EXISTS client_pilot_access(client_id UUID PRIMARY KEY REFERENCES clients(id),email TEXT NOT NULL,reason TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`));return p;
}

// Shared with the proposed one-time report reader and all approved grant/revoke
// paths. Acquire inside BEGIN, before any pilot row DML, on this same connection.
// REVIEW BRANCH ONLY: reader/suspension/direct SQL paths are not yet coordinated.
async function lockPilotTenant(tx,clientId){
 await tx.query("SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-pilot-lock-v1:' || $1::uuid::text, 0))",[clientId]);
}
export function accountHasPaidAccess(account){return Boolean(account?.client?.status==='active'&&(account.payments||[]).some(x=>x.status==='paid'))}
export async function getPilotAccess(clientId){const p=await pool();return (await p.query('SELECT email,expires_at AS "expiresAt" FROM client_pilot_access WHERE client_id=$1 AND revoked_at IS NULL AND expires_at>NOW()',[clientId])).rows[0]||null}
export async function customerAccess(account){
 // Fail closed for suspended, inactive, deleted or unknown account states.
 // A paid invoice or pilot grant must not override a non-active client status.
 if(account?.client?.status!=='active')return {allowed:false};
 if(accountHasPaidAccess(account))return {allowed:true,kind:'paid'};
 const pilot=await getPilotAccess(account.client.id);return pilot?{allowed:true,kind:'pilot',...pilot}:{allowed:false};
}
export async function grantPilot(clientId,email,days,reason){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Number.isInteger(days)||days<1||days>30||reason.length<10)throw Error('invalid-pilot');
 const p=await pool(),tx=await p.connect();
 try{await tx.query('BEGIN');await lockPilotTenant(tx,clientId);await tx.query(`INSERT INTO client_pilot_access(client_id,email,reason,expires_at) VALUES($1,$2,$3,NOW()+($4 * INTERVAL '1 day')) ON CONFLICT(client_id) DO UPDATE SET email=EXCLUDED.email,reason=EXCLUDED.reason,expires_at=EXCLUDED.expires_at,revoked_at=NULL`,[clientId,email.toLowerCase(),reason,days]);await tx.query(`INSERT INTO client_activity(id,client_id,event_type,title,detail,metadata) VALUES($4,$1,'pilot-granted','Ücretsiz analiz pilotu açıldı',$2,$3)`,[clientId,reason,JSON.stringify({days,scope:'diagnosis-report',noPayment:true}),crypto.randomUUID()]);await tx.query('COMMIT')}catch(e){await tx.query('ROLLBACK');throw e}finally{tx.release()}
}
export async function revokePilot(clientId){
 const p=await pool(),tx=await p.connect();
 try{await tx.query('BEGIN');await lockPilotTenant(tx,clientId);const row=(await tx.query('UPDATE client_pilot_access SET revoked_at=NOW() WHERE client_id=$1 AND revoked_at IS NULL RETURNING expires_at',[clientId])).rows[0];
 if(row)await tx.query(`INSERT INTO client_activity(id,client_id,event_type,title,detail,metadata) VALUES($1,$2,'pilot-revoked','Ücretsiz analiz pilotu kapatıldı','Yönetici pilot erişimini kaldırdı.',$3::jsonb)`,[crypto.randomUUID(),clientId,JSON.stringify({scope:'diagnosis-report',noPayment:true,previousExpiresAt:row.expires_at})]);
 await tx.query('COMMIT');return {revoked:Boolean(row)};
 }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e}finally{tx.release()}
}

/**
 * Review-only report read boundary. Serialize the authoritative entitlement
 * recheck, tenant evidence read and complete PDF generation against all
 * coordinated pilot grant/revoke and account-status writers.
 * The callback must finish constructing the response before COMMIT; never
 * stream response generation outside the advisory-lock transaction.
 * Independent-session Neon acceptance remains required.
 */
export async function withTenantReportLock(clientId,buildResponse){
 const p=databasePool(getDatabaseUrl());
 const tx=await p.connect();
 try{
  await tx.query('BEGIN');
  await tx.query("SET LOCAL lock_timeout = '5s'");
  await lockPilotTenant(tx,clientId);
  const response=await buildResponse();
  await tx.query('COMMIT');
  return response;
 }catch(error){
  await tx.query('ROLLBACK').catch(()=>{});
  throw error;
 }finally{
  tx.release();
 }
}
