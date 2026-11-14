import crypto from "node:crypto";
import {customerHasVerifiedSettlement} from './customer-settlement-proof.mjs';
import {databasePool,initializeSchema} from './database-runtime';
import {getDatabaseUrl,getPortalReadDatabaseUrl} from './db';
async function pool({ensureSchema=true,portalRead=false}={}){
 const p=databasePool(portalRead?getPortalReadDatabaseUrl():getDatabaseUrl());
 if(ensureSchema)await initializeSchema(p,'pilot-access',tx=>tx.query(`CREATE TABLE IF NOT EXISTS client_pilot_access(client_id UUID PRIMARY KEY REFERENCES clients(id),email TEXT NOT NULL,reason TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`));return p;
}
export function accountHasPaidAccess(account){return Boolean(account&&account.client?.status!=='payment-review'&&(account.payments||[]).some(x=>x.status==='paid'))}
export async function getPilotAccess(clientId){const p=await pool({ensureSchema:false,portalRead:true});return (await p.query('SELECT email,expires_at AS "expiresAt" FROM client_pilot_access WHERE client_id=$1 AND revoked_at IS NULL AND expires_at>NOW()',[clientId])).rows[0]||null}
export async function customerAccess(account){
 if(!account)return {allowed:false};
 // A suspended account must not regain report access through an older pilot.
 if(account.client?.status==='payment-review')return {allowed:false};
 const paidLabel=accountHasPaidAccess(account);
 if(paidLabel){
  // Legacy behavior only until the separately approved strict launch flag is enabled.
  if(process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED!=='true')
   return {allowed:true,kind:'paid'};
  if(await customerHasVerifiedSettlement(account.client.id))
   return {allowed:true,kind:'paid'};
 }
 // A historical bank-transfer "paid" label must not suppress a separately
 // authorized and unexpired pilot; the pilot has its own explicit entitlement.
 const pilot=await getPilotAccess(account.client.id);
 if(pilot)return {allowed:true,kind:'pilot',...pilot};
 return paidLabel
  ?{allowed:false,kind:'payment-review',reason:'independent-settlement-proof-required'}
  :{allowed:false};
}
export async function grantPilot(clientId,email,days,reason){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Number.isInteger(days)||days<1||days>30||reason.length<10)throw Error('invalid-pilot');
 const p=await pool(),tx=await p.connect();
 try{await tx.query('BEGIN');await tx.query(`INSERT INTO client_pilot_access(client_id,email,reason,expires_at) VALUES($1,$2,$3,NOW()+($4 * INTERVAL '1 day')) ON CONFLICT(client_id) DO UPDATE SET email=EXCLUDED.email,reason=EXCLUDED.reason,expires_at=EXCLUDED.expires_at,revoked_at=NULL`,[clientId,email.toLowerCase(),reason,days]);await tx.query(`INSERT INTO client_activity(id,client_id,event_type,title,detail,metadata) VALUES($4,$1,'pilot-granted','Ücretsiz analiz pilotu açıldı',$2,$3)`,[clientId,reason,JSON.stringify({days,scope:'diagnosis-report',noPayment:true}),crypto.randomUUID()]);await tx.query('COMMIT')}catch(e){await tx.query('ROLLBACK');throw e}finally{tx.release()}
}
export async function revokePilot(clientId){
 const p=await pool(),tx=await p.connect();
 try{await tx.query('BEGIN');const row=(await tx.query('UPDATE client_pilot_access SET revoked_at=NOW() WHERE client_id=$1 AND revoked_at IS NULL RETURNING expires_at',[clientId])).rows[0];
 if(row)await tx.query(`INSERT INTO client_activity(id,client_id,event_type,title,detail,metadata) VALUES($1,$2,'pilot-revoked','Ücretsiz analiz pilotu kapatıldı','Yönetici pilot erişimini kaldırdı.',$3::jsonb)`,[crypto.randomUUID(),clientId,JSON.stringify({scope:'diagnosis-report',noPayment:true,previousExpiresAt:row.expires_at})]);
 await tx.query('COMMIT');return {revoked:Boolean(row)};
 }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e}finally{tx.release()}
}
