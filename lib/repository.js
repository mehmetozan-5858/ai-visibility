import {readCommercialMetrics} from './commercial-metrics';
import {ensureBankConfirmation,recordBankConfirmation} from './bank-confirmation';
import {ensureWorkEvidence,updateWorkWithEvidence} from './work-evidence';
import {databasePool,initializeSchema} from "./database-runtime";
// Persistent repository backed by PostgreSQL/Neon when DATABASE_URL is present.
import { databaseStatus,getDatabaseUrl } from "./db";

function normalizeDatabaseUrl(rawUrl){
  if(!rawUrl) return "";
  try{
    const url=new URL(rawUrl);
    const sslmode=url.searchParams.get("sslmode");
    if(["prefer","require","verify-ca"].includes(sslmode)){
      url.searchParams.set("sslmode","verify-full");
    }
    return url.toString();
  }catch{
    return rawUrl;
  }
}

async function withDb(fn){
 const url=normalizeDatabaseUrl(getDatabaseUrl());if(!url)return null;
 const pool=databasePool(url);await initializeSchema(pool,"repository",ensure);await ensureWorkEvidence(pool);return await fn(pool);
}

async function ensure(pool){
  await pool.query(`CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'Starter',
    competitors JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    queries JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'queued',
    score INTEGER,
    results JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS work_items (
    id UUID PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'implementation',
    status TEXT NOT NULL DEFAULT 'ready',
    detail TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'implementation-agent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    reference_code TEXT NOT NULL UNIQUE,
    method TEXT NOT NULL DEFAULT 'bank-transfer',
    status TEXT NOT NULL DEFAULT 'pending',
    plan TEXT NOT NULL DEFAULT 'Starter',
    setup_amount INTEGER NOT NULL DEFAULT 0,
    monthly_amount INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reported_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ
  )`);
  await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT '';");
  await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS service_start_consent_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS terms_version TEXT");
  await pool.query(`CREATE TABLE IF NOT EXISTS client_activity (
    id UUID PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL DEFAULT 'note',
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sales_pipeline (
    id UUID PRIMARY KEY,
    client_id UUID NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
    stage TEXT NOT NULL DEFAULT 'new',
    priority TEXT NOT NULL DEFAULT 'medium',
    next_follow_up DATE,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

export async function listClients(){
  const rows=await withDb(async pool=>(await pool.query(
    'SELECT id,name,domain,plan,competitors,status,created_at AS "createdAt" FROM clients ORDER BY created_at DESC'
  )).rows);
  return rows||[];
}

export async function addClient(input){
  const id=crypto.randomUUID(), createdAt=new Date().toISOString();
  const row=await withDb(async pool=>(await pool.query(
    'INSERT INTO clients(id,name,domain,plan,competitors,status) VALUES($1,$2,$3,$4,$5::jsonb,$6) RETURNING id,name,domain,plan,competitors,status,created_at AS "createdAt"',
    [id,input.name,input.domain,input.plan||"Starter",JSON.stringify(input.competitors||[]),"active"]
  )).rows[0]);
  return row?{...row,persisted:true}:{id,...input,status:"demo-only",createdAt,persisted:false};
}

export async function createScan(clientId,queries=[]){
  const id=crypto.randomUUID(), createdAt=new Date().toISOString();
  const row=await withDb(async pool=>(await pool.query(
    'INSERT INTO scans(id,client_id,queries,status) VALUES($1,$2,$3::jsonb,$4) RETURNING id,client_id AS "clientId",queries,status,score,results,created_at AS "createdAt",completed_at AS "completedAt"',
    [id,clientId,JSON.stringify(Array.isArray(queries)?queries:[]),"queued"]
  )).rows[0]);
  return row?{...row,persisted:true}:{id,clientId,queries,status:"demo-only",createdAt,persisted:false};
}

export async function listScans(limit=50){
  const safe=Math.max(1,Math.min(Number(limit)||50,100));
  const rows=await withDb(async pool=>(await pool.query(
    'SELECT s.id,s.client_id AS "clientId",c.name AS "clientName",s.queries,s.status,s.score,s.results,s.created_at AS "createdAt",s.completed_at AS "completedAt" FROM scans s JOIN clients c ON c.id=s.client_id ORDER BY s.created_at DESC LIMIT $1',
    [safe]
  )).rows);
  return rows||[];
}

export async function getDashboard(){
  const data=await withDb(async pool=>{
    const r=await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM scans WHERE created_at >= CURRENT_DATE) AS "scansToday",
      ((SELECT COUNT(*)::int FROM work_items WHERE status IN ('approval-required','access-required')) +
       (SELECT COUNT(*)::int FROM payments WHERE status='customer-reported')) AS approvals`);
    return {...r.rows[0],...await readCommercialMetrics(pool)};
  });
  return {activeClients:data?.activeClients||0,mrr:null,mrrByCurrency:data?.mrrByCurrency||[],scansToday:data?.scansToday||0,approvals:data?.approvals||0,database:databaseStatus()};
}


export async function getClient(clientId){
  return await withDb(async pool=>(await pool.query(
    'SELECT id,name,domain,plan,competitors,status,created_at AS "createdAt" FROM clients WHERE id=$1',
    [clientId]
  )).rows[0])||null;
}

export async function completeScan(scanId,result){
  const input=Array.isArray(result)?result:[result];
  const results=input.filter(Boolean).map(x=>({
    provider:x?.provider||"",
    score:Math.max(0,Math.min(100,Number(x?.score)||0)),
    summary:x?.summary||"",
    findings:Array.isArray(x?.findings)?x.findings:[],
    recommendations:Array.isArray(x?.recommendations)?x.recommendations:[],
    visibility:x?.visibility&&typeof x.visibility==="object"?x.visibility:{}
  }));
  const score=results.length?Math.round(results.reduce((a,x)=>a+x.score,0)/results.length):0;
  return await withDb(async pool=>{
    const current=(await pool.query('SELECT client_id FROM scans WHERE id=$1',[scanId])).rows[0];
    const previous=current?(await pool.query(
      "SELECT id,score,results,completed_at FROM scans WHERE client_id=$1 AND id<>$2 AND status='completed' ORDER BY completed_at DESC NULLS LAST,created_at DESC LIMIT 1",
      [current.client_id,scanId]
    )).rows[0]:null;
    const row=(await pool.query(
      'UPDATE scans SET status=$2,score=$3,results=$4::jsonb,completed_at=NOW() WHERE id=$1 RETURNING id,client_id AS "clientId",queries,status,score,results,created_at AS "createdAt",completed_at AS "completedAt"',
      [scanId,"completed",score,JSON.stringify(results)]
    )).rows[0];
    if(row){
      const previousScore=previous?.score==null?null:Number(previous.score);
      const delta=previousScore==null?null:score-previousScore;
      const providerScores=Object.fromEntries(results.map(x=>[x.provider,x.score]));
      const title=previousScore==null?"İlk görünürlük taraması tamamlandı":delta>0?"Yeni taramada iyileşme sinyali görüldü":delta<0?"Yeni taramada gerileme sinyali görüldü":"Yeni tarama önceki skorla aynı";
      const detail=previousScore==null
        ? `Başlangıç görünürlük skoru ${score}/100 olarak kaydedildi.`
        : `Önceki skor ${previousScore}/100, yeni skor ${score}/100, değişim ${delta>0?"+":""}${delta} puan. Bu kayıt otomatik karşılaştırmadır; müşterinin hangi işlemi yaptığı ayrıca faaliyet kaydıyla doğrulanmalıdır.`;
      await pool.query(
        'INSERT INTO client_activity(id,client_id,event_type,title,detail,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)',
        [crypto.randomUUID(),row.clientId,"scan",title,detail,JSON.stringify({scanId:row.id,previousScanId:previous?.id||null,score,previousScore,delta,providerScores,automatic:true})]
      );
    }
    return row;
  });
}


export async function findClientByIdentity(name,domain=""){
  const cleanName=(name||"").trim();
  const cleanDomain=(domain||"").trim();
  return await withDb(async pool=>{
    if(cleanDomain){
      const byDomain=(await pool.query(
        'SELECT id,name,domain,plan,competitors,status,created_at AS "createdAt" FROM clients WHERE lower(domain)=lower($1) LIMIT 1',
        [cleanDomain]
      )).rows[0];
      if(byDomain)return byDomain;
    }
    return (await pool.query(
      'SELECT id,name,domain,plan,competitors,status,created_at AS "createdAt" FROM clients WHERE lower(name)=lower($1) LIMIT 1',
      [cleanName]
    )).rows[0]||null;
  })||null;
}


export async function failScan(scanId,errorMessage=""){
  const results=[{error:String(errorMessage||"Tarama hatası").slice(0,500)}];
  return await withDb(async pool=>(await pool.query(
    'UPDATE scans SET status=$2,results=$3::jsonb,completed_at=NOW() WHERE id=$1 RETURNING id,client_id AS "clientId",queries,status,score,results,created_at AS "createdAt",completed_at AS "completedAt"',
    [scanId,"failed",JSON.stringify(results)]
  )).rows[0]);
}


export async function getLatestCompletedScan(clientId){
  return await withDb(async pool=>(await pool.query(
    'SELECT s.id,s.client_id AS "clientId",c.name AS "clientName",s.queries,s.status,s.score,s.results,s.created_at AS "createdAt",s.completed_at AS "completedAt" FROM scans s JOIN clients c ON c.id=s.client_id WHERE s.client_id=$1 AND s.status=$2 ORDER BY s.completed_at DESC NULLS LAST,s.created_at DESC LIMIT 1',
    [clientId,"completed"]
  )).rows[0])||null;
}


export async function getSalesCandidates(limit=20){
  const safe=Math.max(1,Math.min(Number(limit)||20,50));
  return await withDb(async pool=>(await pool.query(
    `SELECT c.id,c.name,c.domain,c.plan,
      s.id AS "scanId",s.score,s.results,s.completed_at AS "completedAt"
     FROM clients c
     JOIN LATERAL (
       SELECT id,score,results,completed_at
       FROM scans
       WHERE client_id=c.id AND status='completed'
       ORDER BY completed_at DESC NULLS LAST,created_at DESC
       LIMIT 1
     ) s ON true
     ORDER BY s.score ASC NULLS LAST,s.completed_at DESC
     LIMIT $1`,[safe]
  )).rows)||[];
}


export async function saveImplementationWorkItems(clientId,plan={}){
  return await withDb(async pool=>{
    await pool.query("DELETE FROM work_items WHERE client_id=$1 AND source='implementation-agent' AND status<>'completed'",[clientId]);
    const rows=[];
    const add=async(title,category,status,detail)=>{
      if(!title)return;
      const id=crypto.randomUUID();
      const row=(await pool.query(
        'INSERT INTO work_items(id,client_id,title,category,status,detail,source) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,client_id AS "clientId",title,category,status,detail,source,created_at AS "createdAt",updated_at AS "updatedAt"',
        [id,clientId,String(title),category,status,String(detail||""),"implementation-agent"]
      )).rows[0];
      rows.push(row);
    };
    for(const x of plan.readyNow||[])await add(x.title||x.type,"Hazır teslim","ready",x.deliverable||"");
    for(const x of plan.accessRequired||[])await add(x.title||x.system,"Erişim gerekiyor","access-required",x.action||"");
    for(const x of plan.approvalRequired||[])await add(x.field,"Müşteri onayı","approval-required",x.reason||"");
    return rows;
  })||[];
}

export async function listWorkItems(limit=100){
  const safe=Math.max(1,Math.min(Number(limit)||100,200));
  return await withDb(async pool=>(await pool.query(
    'SELECT w.id,w.client_id AS "clientId",c.name AS "clientName",w.title,w.category,w.status,w.detail,w.source,w.completion_evidence AS "completionEvidence",w.evidence_url AS "evidenceUrl",w.evidence_recorded_at AS "evidenceRecordedAt",w.created_at AS "createdAt",w.updated_at AS "updatedAt" FROM work_items w JOIN clients c ON c.id=w.client_id ORDER BY CASE w.status WHEN \'approval-required\' THEN 1 WHEN \'access-required\' THEN 2 WHEN \'ready\' THEN 3 WHEN \'in-progress\' THEN 4 WHEN \'completed\' THEN 5 ELSE 6 END,w.updated_at DESC LIMIT $1',
    [safe]
  )).rows)||[];
}

export async function updateWorkItem(id,status,evidence={},expectedStatus){
 return await withDb(pool=>updateWorkWithEvidence(pool,id,status,evidence,expectedStatus));
}


export async function getOrCreatePaymentIntent(clientId,plan="Starter",setupAmount=0,monthlyAmount=0,currency=""){
  const setup=Math.max(0,Math.round(Number(setupAmount)||0));
  const monthly=Math.max(0,Math.round(Number(monthlyAmount)||0));
  const cur=["TRY","USD","EUR","GBP"].includes(String(currency||"").toUpperCase())?String(currency).toUpperCase():"";
  return await withDb(async pool=>{
    let row=(await pool.query(
      "SELECT id,client_id AS \"clientId\",reference_code AS \"referenceCode\",method,status,plan,currency,setup_amount AS \"setupAmount\",monthly_amount AS \"monthlyAmount\",created_at AS \"createdAt\",reported_at AS \"reportedAt\",paid_at AS \"paidAt\" FROM payments WHERE client_id=$1 AND status IN ('pending','customer-reported') AND plan=$2 AND setup_amount=$3 AND monthly_amount=$4 AND currency=$5 ORDER BY created_at DESC LIMIT 1",
      [clientId,plan,setup,monthly,cur]
    )).rows[0];
    if(row)return row;
    const id=crypto.randomUUID();
    const referenceCode=("AIV-"+id.slice(0,8)).toUpperCase();
    row=(await pool.query(
      'INSERT INTO payments(id,client_id,reference_code,method,status,plan,setup_amount,monthly_amount,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,client_id AS "clientId",reference_code AS "referenceCode",method,status,plan,currency,setup_amount AS "setupAmount",monthly_amount AS "monthlyAmount",created_at AS "createdAt",reported_at AS "reportedAt",paid_at AS "paidAt"',
      [id,clientId,referenceCode,"bank-transfer","pending",plan,setup,monthly,cur]
    )).rows[0];
    return row;
  })||null;
}

export async function recordPaymentConsent(paymentId,termsVersion="2026-10-02"){
  return await withDb(async pool=>(await pool.query(
    'UPDATE payments SET service_start_consent_at=COALESCE(service_start_consent_at,NOW()),terms_version=COALESCE(terms_version,$2) WHERE id=$1 RETURNING id,service_start_consent_at AS "serviceStartConsentAt",terms_version AS "termsVersion"',
    [paymentId,String(termsVersion||"2026-10-02").slice(0,40)]
  )).rows[0])||null;
}

export async function reportPayment(paymentId){
  return await withDb(async pool=>(await pool.query(
    "UPDATE payments SET status='customer-reported',reported_at=NOW() WHERE id=$1 AND status='pending' RETURNING id,client_id AS \"clientId\",reference_code AS \"referenceCode\",method,status,plan,currency,setup_amount AS \"setupAmount\",monthly_amount AS \"monthlyAmount\",created_at AS \"createdAt\",reported_at AS \"reportedAt\",paid_at AS \"paidAt\"",
    [paymentId]
  )).rows[0])||null;
}

export async function listPayments(limit=100){
  const safe=Math.max(1,Math.min(Number(limit)||100,200));
  return await withDb(async pool=>(await pool.query(
    'SELECT p.id,p.client_id AS "clientId",c.name AS "clientName",p.reference_code AS "referenceCode",p.method,p.status,p.plan,p.currency,p.setup_amount AS "setupAmount",p.monthly_amount AS "monthlyAmount",p.created_at AS "createdAt",p.reported_at AS "reportedAt",p.paid_at AS "paidAt" FROM payments p JOIN clients c ON c.id=p.client_id ORDER BY CASE p.status WHEN \'customer-reported\' THEN 1 WHEN \'pending\' THEN 2 WHEN \'paid\' THEN 3 ELSE 4 END,p.created_at DESC LIMIT $1',
    [safe]
  )).rows)||[];
}

export async function confirmPayment(id,options={}){
  return withDb(async pool=>{
    if(options.bankEvidence)await ensureBankConfirmation(pool);
    const tx=await pool.connect();
    try{
      await tx.query("BEGIN");
      const row=(await tx.query(`UPDATE payments SET status='paid',paid_at=NOW()
        WHERE id=$1 AND status='customer-reported' AND setup_amount+monthly_amount>0
        RETURNING id,client_id AS "clientId",reference_code AS "referenceCode",method,status,plan,currency,
        setup_amount AS "setupAmount",monthly_amount AS "monthlyAmount",paid_at AS "paidAt"`,[id])).rows[0];
      if(row){
       if(options.bankEvidence)await recordBankConfirmation(tx,row,options.bankEvidence);
       await tx.query("UPDATE clients SET plan=$2,status='active' WHERE id=$1",[row.clientId,row.plan]);
       const tables=(await tx.query("SELECT to_regclass('public.prospects') AS business,to_regclass('public.creator_hunt_leads') AS creator")).rows[0]||{};
       if(tables.business)await tx.query("UPDATE prospects SET crm_stage='won',reply_status='won',payment_link_status='paid',follow_up_at=NULL WHERE client_id=$1",[row.clientId]);
       if(tables.creator)await tx.query("UPDATE creator_hunt_leads SET crm_stage='won',payment_link_status='paid',next_follow_up=NULL,follow_up_due_at=NULL,updated_at=NOW() WHERE client_id=$1",[row.clientId]);
      }
      await tx.query("COMMIT");return row||null;
    }catch(e){await tx.query("ROLLBACK").catch(()=>{});throw e}finally{tx.release()}
  });
}


export async function upsertSalesOpportunity(clientId,{priority="medium"}={}){
  return await withDb(async pool=>{
    const existing=(await pool.query('SELECT id FROM sales_pipeline WHERE client_id=$1',[clientId])).rows[0];
    if(existing){
      return (await pool.query(
        'UPDATE sales_pipeline SET priority=$2,updated_at=NOW() WHERE client_id=$1 RETURNING id,client_id AS "clientId",stage,priority,next_follow_up AS "nextFollowUp",notes,created_at AS "createdAt",updated_at AS "updatedAt"',
        [clientId,priority]
      )).rows[0];
    }
    return (await pool.query(
      'INSERT INTO sales_pipeline(id,client_id,stage,priority) VALUES($1,$2,$3,$4) RETURNING id,client_id AS "clientId",stage,priority,next_follow_up AS "nextFollowUp",notes,created_at AS "createdAt",updated_at AS "updatedAt"',
      [crypto.randomUUID(),clientId,"new",priority]
    )).rows[0];
  })||null;
}

export async function listSalesPipeline(limit=100){
  const safe=Math.max(1,Math.min(Number(limit)||100,200));
  return await withDb(async pool=>(await pool.query(
    `SELECT p.id,p.client_id AS "clientId",c.name AS "clientName",c.domain,p.stage,p.priority,p.next_follow_up AS "nextFollowUp",p.notes,
      p.created_at AS "createdAt",p.updated_at AS "updatedAt",
      s.score
     FROM sales_pipeline p
     JOIN clients c ON c.id=p.client_id
     LEFT JOIN LATERAL (
       SELECT score FROM scans WHERE client_id=c.id AND status='completed'
       ORDER BY completed_at DESC NULLS LAST,created_at DESC LIMIT 1
     ) s ON true
     ORDER BY CASE p.stage WHEN 'proposal' THEN 1 WHEN 'meeting' THEN 2 WHEN 'contacted' THEN 3 WHEN 'new' THEN 4 WHEN 'won' THEN 5 WHEN 'lost' THEN 6 ELSE 7 END,p.updated_at DESC
     LIMIT $1`,[safe]
  )).rows)||[];
}

export async function updateSalesOpportunity(id,{stage,nextFollowUp,notes}={}){
  const allowed=new Set(["new","contacted","meeting","proposal","won","lost"]);
  if(stage&&!allowed.has(stage))throw new Error("invalid-sales-stage");
  return await withDb(async pool=>(await pool.query(
    'UPDATE sales_pipeline SET stage=COALESCE($2,stage),next_follow_up=$3,notes=COALESCE($4,notes),updated_at=NOW() WHERE id=$1 RETURNING id,client_id AS "clientId",stage,priority,next_follow_up AS "nextFollowUp",notes,created_at AS "createdAt",updated_at AS "updatedAt"',
    [id,stage||null,nextFollowUp||null,notes===undefined?null:String(notes||"").trim().slice(0,3000)]
  )).rows[0])||null;
}


export async function getPaymentById(id){
  return await withDb(async pool=>(await pool.query(
    'SELECT p.id,p.client_id AS "clientId",c.name AS "clientName",c.domain,p.reference_code AS "referenceCode",p.method,p.status,p.plan,p.currency,p.setup_amount AS "setupAmount",p.monthly_amount AS "monthlyAmount",p.created_at AS "createdAt",p.reported_at AS "reportedAt",p.paid_at AS "paidAt" FROM payments p JOIN clients c ON c.id=p.client_id WHERE p.id=$1',
    [id]
  )).rows[0])||null;
}

export async function confirmCardPaymentByMerchantOid(merchantOid){
  return await withDb(async pool=>{
    const row=(await pool.query(
      "UPDATE payments SET status='paid',method='card',paid_at=COALESCE(paid_at,NOW()) WHERE replace(reference_code,'-','')=$1 AND status<>'paid' RETURNING id,client_id AS \"clientId\",reference_code AS \"referenceCode\",method,status,plan,currency,setup_amount AS \"setupAmount\",monthly_amount AS \"monthlyAmount\",created_at AS \"createdAt\",reported_at AS \"reportedAt\",paid_at AS \"paidAt\"",
      [merchantOid]
    )).rows[0];
    if(row)await pool.query("UPDATE clients SET plan=$2,status='active' WHERE id=$1",[row.clientId,row.plan]);
    if(row)return row;
    return (await pool.query(
      "SELECT id,client_id AS \"clientId\",reference_code AS \"referenceCode\",method,status,plan,currency,setup_amount AS \"setupAmount\",monthly_amount AS \"monthlyAmount\",created_at AS \"createdAt\",reported_at AS \"reportedAt\",paid_at AS \"paidAt\" FROM payments WHERE replace(reference_code,'-','')=$1",
      [merchantOid]
    )).rows[0]||null;
  })||null;
}

export async function markCardPaymentFailedByMerchantOid(merchantOid){
  return await withDb(async pool=>(await pool.query(
    "UPDATE payments SET status='failed',method='card' WHERE replace(reference_code,'-','')=$1 AND status<>'paid' RETURNING id,client_id AS \"clientId\",reference_code AS \"referenceCode\",method,status,plan,currency,setup_amount AS \"setupAmount\",monthly_amount AS \"monthlyAmount\",created_at AS \"createdAt\",reported_at AS \"reportedAt\",paid_at AS \"paidAt\"",
    [merchantOid]
  )).rows[0])||null;
}


export async function addClientActivity(clientId,{eventType="note",title="",detail="",metadata={}}={}){
  const allowed=new Set(["contact","report","recommendation","customer-action","approval","scan","payment","note","complaint","refund"]);
  const type=allowed.has(eventType)?eventType:"note";
  const cleanTitle=String(title||"").trim().slice(0,180);
  if(!cleanTitle)throw new Error("activity-title-required");
  return await withDb(async pool=>(await pool.query(
    'INSERT INTO client_activity(id,client_id,event_type,title,detail,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING id,client_id AS "clientId",event_type AS "eventType",title,detail,metadata,created_at AS "createdAt"',
    [crypto.randomUUID(),clientId,type,cleanTitle,String(detail||"").trim().slice(0,4000),JSON.stringify(metadata||{})]
  )).rows[0])||null;
}

export async function getClientAccount(clientId){
  return await withDb(async pool=>{
    const client=(await pool.query(
      'SELECT id,name,domain,plan,competitors,status,created_at AS "createdAt" FROM clients WHERE id=$1',[clientId]
    )).rows[0];
    if(!client)return null;
    const scans=(await pool.query(
      'SELECT id,status,score,results,created_at AS "createdAt",completed_at AS "completedAt" FROM scans WHERE client_id=$1 ORDER BY created_at DESC LIMIT 30',[clientId]
    )).rows;
    const activity=(await pool.query(
      'SELECT id,event_type AS "eventType",title,detail,metadata,created_at AS "createdAt" FROM client_activity WHERE client_id=$1 ORDER BY created_at DESC LIMIT 120',[clientId]
    )).rows;
    const workItems=(await pool.query(
      'SELECT id,title,category,status,detail,source,created_at AS "createdAt",updated_at AS "updatedAt" FROM work_items WHERE client_id=$1 ORDER BY updated_at DESC LIMIT 80',[clientId]
    )).rows;
    const payments=(await pool.query(
      'SELECT id,reference_code AS "referenceCode",method,status,plan,currency,setup_amount AS "setupAmount",monthly_amount AS "monthlyAmount",service_start_consent_at AS "serviceStartConsentAt",terms_version AS "termsVersion",created_at AS "createdAt",reported_at AS "reportedAt",paid_at AS "paidAt" FROM payments WHERE client_id=$1 ORDER BY created_at DESC LIMIT 20',[clientId]
    )).rows;
    return {client,scans,activity,workItems,payments};
  })||null;
}


export async function getPaymentByMerchantOid(merchantOid){
  return await withDb(async pool=>(await pool.query(
    'SELECT id,client_id AS "clientId",reference_code AS "referenceCode",method,status,plan,currency,setup_amount AS "setupAmount",monthly_amount AS "monthlyAmount",service_start_consent_at AS "serviceStartConsentAt",terms_version AS "termsVersion",created_at AS "createdAt",reported_at AS "reportedAt",paid_at AS "paidAt" FROM payments WHERE replace(reference_code,\'-\',\'\')=$1 LIMIT 1',
    [String(merchantOid||"")]
  )).rows[0])||null;
}


export async function getPaidClientsNeedingImplementation(limit=25){
  const safe=Math.max(1,Math.min(Number(limit)||25,100));
  return await withDb(async pool=>(await pool.query(`
    SELECT DISTINCT ON (c.id) c.id,c.name,c.domain,c.plan,p.paid_at AS "paidAt"
    FROM clients c JOIN payments p ON p.client_id=c.id AND p.status='paid'
    WHERE NOT EXISTS(SELECT 1 FROM work_items w WHERE w.client_id=c.id AND w.source='implementation-agent')
    ORDER BY c.id,p.paid_at DESC LIMIT $1`,[safe])).rows)||[];
}

export async function addClientActivityEvent(clientId,eventType,title,detail="",metadata={}){
  return await withDb(async pool=>(await pool.query(
    'INSERT INTO client_activity(id,client_id,event_type,title,detail,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING id',
    [crypto.randomUUID(),clientId,eventType,title,detail,JSON.stringify(metadata||{})]
  )).rows[0])||null;
}


export async function getClientsReadyForRemeasurement(limit=20,clientId=null){
  const safe=Math.max(1,Math.min(Number(limit)||20,100));
  return await withDb(async pool=>(await pool.query(`
    SELECT c.id,c.name,c.domain,c.plan,
      MAX(w.updated_at) FILTER (WHERE w.status='completed') AS "implementationCompletedAt",
      MAX(s.completed_at) FILTER (WHERE s.status='completed') AS "lastScanAt"
    FROM clients c
    JOIN work_items w ON w.client_id=c.id AND w.source='implementation-agent'
    LEFT JOIN scans s ON s.client_id=c.id
    WHERE ($2::uuid IS NULL OR c.id=$2)
    GROUP BY c.id,c.name,c.domain,c.plan,c.status
    HAVING c.domain NOT LIKE '%.local' AND c.status='active'
      AND EXISTS(SELECT 1 FROM payments p WHERE p.client_id=c.id AND p.status='paid' AND COALESCE(p.terms_version,'') NOT LIKE 'test-flow-%')
      AND COUNT(*) FILTER (WHERE w.status<>'completed' OR LENGTH(w.completion_evidence)<20 OR w.evidence_recorded_at IS NULL)=0
      AND COUNT(*) FILTER (WHERE w.status='completed')>0
      AND (MAX(s.completed_at) FILTER (WHERE s.status='completed') IS NULL
        OR MAX(s.completed_at) FILTER (WHERE s.status='completed') < MAX(w.updated_at) FILTER (WHERE w.status='completed'))
    ORDER BY MAX(w.updated_at) DESC LIMIT $1`,[safe,clientId])).rows)||[];
}

export async function getScanComparison(clientId){
  const rows=await withDb(async pool=>(await pool.query(`
    SELECT id,score,results,completed_at AS "completedAt" FROM scans
    WHERE client_id=$1 AND status='completed' ORDER BY completed_at DESC NULLS LAST,created_at DESC LIMIT 2`,[clientId])).rows)||[];
  if(rows.length<2)return null;
  const current=rows[0],previous=rows[1],delta=Number(current.score)-Number(previous.score);
  return {clientId,previous,current,delta,improved:delta>0,unchanged:delta===0};
}


export async function getExecutiveFunnelSnapshot(){
  return await withDb(async pool=>{
    const q=async(sql)=>(await pool.query(sql)).rows[0]||{};
    const [prospects,payments,work,remeasure]=await Promise.all([
      q(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER(WHERE qualification_level IN ('warm','hot'))::int AS qualified,
        COUNT(*) FILTER(WHERE communication_status='sent')::int AS contacted,
        COUNT(*) FILTER(WHERE COALESCE(reply_status,'')<>'')::int AS replies,
        COUNT(*) FILTER(WHERE crm_stage IN ('proposal','won'))::int AS proposals,
        COUNT(*) FILTER(WHERE crm_stage='won')::int AS won
        FROM prospects`),
      readCommercialMetrics(pool),
      q(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER(WHERE status='completed')::int AS completed,
        COUNT(*) FILTER(WHERE status IN ('approval-required','access-required'))::int AS blocked
        FROM work_items`),
      q(`SELECT COUNT(*)::int AS comparisons,
        COUNT(*) FILTER(WHERE (metadata->>'delta')::numeric>0)::int AS improved,
        COALESCE(AVG((metadata->>'delta')::numeric) FILTER(WHERE metadata ? 'delta'),0)::numeric AS avg_delta
        FROM client_activity WHERE event_type='remeasurement'`)
    ]);
    return {prospects,payments,work,remeasurement:{...remeasure,avgDelta:Number(remeasure.avg_delta||0)}};
  })||{prospects:{},payments:{},work:{},remeasurement:{}};
}

export async function getPredictiveRiskSignals(){
  return await withDb(async pool=>{
    const rows=(await pool.query(`
      SELECT c.id AS "clientId",c.name,
        COUNT(w.id) FILTER(WHERE w.status IN ('approval-required','access-required'))::int AS blocked,
        MIN(w.updated_at) FILTER(WHERE w.status IN ('approval-required','access-required')) AS "oldestBlockedAt"
      FROM clients c LEFT JOIN work_items w ON w.client_id=c.id
      GROUP BY c.id,c.name
      HAVING COUNT(w.id) FILTER(WHERE w.status IN ('approval-required','access-required'))>0
      ORDER BY MIN(w.updated_at) ASC LIMIT 20`)).rows;
    return rows.map(x=>({...x,risk:"implementation-blocked"}));
  })||[];
}
