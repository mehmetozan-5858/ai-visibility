import crypto from "node:crypto";
import {databasePool,initializeSchema} from './database-runtime';
import {getDatabaseUrl} from './db';
async function pool(){
 const p=databasePool(getDatabaseUrl());
 await initializeSchema(p,'pilot-access',tx=>tx.query(`CREATE TABLE IF NOT EXISTS client_pilot_access(client_id UUID PRIMARY KEY REFERENCES clients(id),email TEXT NOT NULL,reason TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`));return p;
}
export function accountHasPaidAccess(account){return Boolean(account&&account.client?.status!=='payment-review'&&(account.payments||[]).some(x=>x.status==='paid'))}
export async function getPilotAccess(clientId){const p=await pool();return (await p.query('SELECT email,expires_at AS "expiresAt" FROM client_pilot_access WHERE client_id=$1 AND revoked_at IS NULL AND expires_at>NOW()',[clientId])).rows[0]||null}
export async function customerAccess(account){
 if(!account)return {allowed:false};
 if(accountHasPaidAccess(account))return {allowed:true,kind:'paid'};
 const pilot=await getPilotAccess(account.client.id);return pilot?{allowed:true,kind:'pilot',...pilot}:{allowed:false};
}
export async function grantPilot(clientId,email,days,reason){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Number.isInteger(days)||days<1||days>30||reason.length<10)throw Error('invalid-pilot');
 const p=await pool(),tx=await p.connect();
 try{await tx.query('BEGIN');await tx.query(`INSERT INTO client_pilot_access(client_id,email,reason,expires_at) VALUES($1,$2,$3,NOW()+($4 * INTERVAL '1 day')) ON CONFLICT(client_id) DO UPDATE SET email=EXCLUDED.email,reason=EXCLUDED.reason,expires_at=EXCLUDED.expires_at,revoked_at=NULL`,[clientId,email.toLowerCase(),reason,days]);await tx.query(`INSERT INTO client_activity(id,client_id,event_type,title,detail,metadata) VALUES($4,$1,'pilot-granted','Ücretsiz analiz pilotu açıldı',$2,$3)`,[clientId,reason,JSON.stringify({days,scope:'diagnosis-report',noPayment:true}),crypto.randomUUID()]);await tx.query('COMMIT')}catch(e){await tx.query('ROLLBACK');throw e}finally{tx.release()}
}
export async function revokePilot(clientId){const p=await pool();await p.query('UPDATE client_pilot_access SET revoked_at=NOW() WHERE client_id=$1',[clientId])}
