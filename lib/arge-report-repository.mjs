import {randomUUID} from 'node:crypto';
import {prepareAuthorizedAuditReport} from './authorized-audit-report.mjs';
const validId=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(v);
const iso=v=>v instanceof Date?v.toISOString():v;

/** Verified session comes from server signature verification, never JSON.
 * Membership, grant and ledger are loaded in one transaction. No provider,
 * billing, email, migration, background job or deployment is performed here.
 */
export async function createStoredRevenuePreview({pool,session,accountClientId,requestId,
 featureEnabled=false,globallyEnabled=false}={}){
 if(!validId(session?.clientId)||session.clientId!==accountClientId||!validId(requestId))
  return {ok:false,reason:'invalid-session-or-request'};
 if(featureEnabled!==true||globallyEnabled!==true)return {ok:false,reason:'feature-disabled'};
 const tenantId=accountClientId,actorId=session.clientId;
 const tx=await pool.connect();
 try{
  await tx.query('BEGIN');
  // The signed customer owns one actor/tenant scope. Lock its membership row
  // to serialize concurrent previews and enforce the durable daily limit.
  const member=(await tx.query('SELECT role,enabled FROM arge_memberships WHERE tenant_id=$1 AND actor_id=$2 FOR UPDATE',[tenantId,actorId])).rows[0];
  const grant=(await tx.query(`SELECT status,revoked,expires_at AS "expiresAt",not_before AS "notBefore",
   consent_verified AS "consentVerified",consent_revoked AS "consentRevoked" FROM arge_entitlements
   WHERE tenant_id=$1 AND service_id=$2 FOR SHARE`,[tenantId,'agent-audit-control'])).rows[0];
  const context={actor:{id:actorId,authenticated:true},
   membership:{actorId,tenantId,role:member?.role,verified:member?.enabled===true},
   sessionClientId:session.clientId,accountClientId,featureEnabled,globallyEnabled,
   entitlement:grant?{...grant,source:'server',clientId:tenantId,serviceId:'agent-audit-control',expiresAt:iso(grant.expiresAt),
    ...(grant.notBefore==null?{notBefore:undefined}:{notBefore:iso(grant.notBefore)})}:undefined,
   kind:'revenue-integrity'};
  // Check access before reading any tenant ledger rows or replaying a report.
  const authorized=prepareAuthorizedAuditReport({...context,input:{expected:[],invoiced:[]}});
  if(!authorized.ok){await tx.query('ROLLBACK');return authorized;}
  const previous=(await tx.query('SELECT id,report,audit_event_id AS "auditEventId" FROM arge_report_previews WHERE tenant_id=$1 AND request_id=$2',[tenantId,requestId])).rows[0];
  if(previous){
   await tx.query('COMMIT');
   return {ok:true,state:'stored-preview',reportId:previous.id,report:previous.report,auditEventId:previous.auditEventId,
    auditPersisted:true,replayed:true,customerDeliveryAuthorized:false};
  }
  const daily=(await tx.query(`SELECT COUNT(*)::int AS n FROM arge_report_previews WHERE tenant_id=$1
   AND created_at >= (date_trunc('day',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`,[tenantId])).rows[0].n;
  if(daily>=30){await tx.query('ROLLBACK');return {ok:false,reason:'preview-daily-limit'};}
  const records=(await tx.query(`SELECT id,tenant_id AS "tenantId",subscription_id AS "subscriptionId",
   source_id AS "sourceId",period,currency,amount_minor AS "amountMinor",record_kind AS kind
   FROM arge_revenue_ledger WHERE tenant_id=$1 ORDER BY record_kind,id LIMIT 10001`,[tenantId])).rows;
  if(records.length>10000){await tx.query('ROLLBACK');return {ok:false,reason:'ledger-budget-exceeded'};}
  const prepared=prepareAuthorizedAuditReport({...context,input:{expected:records.filter(r=>r.kind==='expected'),invoiced:records.filter(r=>r.kind==='invoiced')}});
  if(!prepared.ok){await tx.query('ROLLBACK');return prepared;}
  const reportId=randomUUID(),event=prepared.auditEvent;
  const inserted=(await tx.query(`INSERT INTO arge_report_previews(id,tenant_id,request_id,kind,report,audit_event_id)
   VALUES($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT(tenant_id,request_id) DO NOTHING RETURNING id`,
   [reportId,tenantId,requestId,'revenue-integrity',JSON.stringify(prepared.report),event.id])).rows[0];
  if(inserted){
   await tx.query(`INSERT INTO arge_audit_events(id,tenant_id,actor_id,service_id,event_type,occurred_at,payload)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[event.id,tenantId,actorId,event.serviceId,event.eventType,event.occurredAt,
     JSON.stringify({...event,state:'persisted'})]);
  }
  const saved=(await tx.query('SELECT id,report,audit_event_id AS "auditEventId" FROM arge_report_previews WHERE tenant_id=$1 AND request_id=$2',[tenantId,requestId])).rows[0];
  if(!saved)throw Error('report-write-unconfirmed');
  await tx.query('COMMIT');
  return {ok:true,state:'stored-preview',reportId:saved.id,report:saved.report,auditEventId:saved.auditEventId,
   auditPersisted:true,replayed:!inserted,customerDeliveryAuthorized:false};
 }catch(error){await tx.query('ROLLBACK').catch(()=>{});throw error;}finally{tx.release();}
}
