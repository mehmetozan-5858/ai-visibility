// Persistent repository backed by PostgreSQL/Neon when DATABASE_URL is present.
import { databaseStatus,getDatabaseUrl } from "./db";

async function withDb(fn){
  const url=getDatabaseUrl(); if(!url) return null;
  const { Pool } = await import("pg");
  const pool = new Pool({connectionString:url,ssl:{rejectUnauthorized:false}});
  try{ await ensure(pool); return await fn(pool); }
  finally{ await pool.end(); }
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reported_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ
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
      (SELECT COUNT(*)::int FROM clients WHERE status='active') AS "activeClients",
      (SELECT COUNT(*)::int FROM scans WHERE created_at >= CURRENT_DATE) AS "scansToday",
      ((SELECT COUNT(*)::int FROM work_items WHERE status IN ('approval-required','access-required')) +
       (SELECT COUNT(*)::int FROM payments WHERE status='customer-reported')) AS approvals,
      (SELECT COALESCE(SUM(monthly_amount),0)::int FROM payments WHERE status='paid') AS mrr`);
    return r.rows[0];
  });
  return {activeClients:data?.activeClients||0,mrr:data?.mrr||0,scansToday:data?.scansToday||0,approvals:data?.approvals||0,database:databaseStatus()};
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
    recommendations:Array.isArray(x?.recommendations)?x.recommendations:[]
  }));
  const score=results.length?Math.round(results.reduce((a,x)=>a+x.score,0)/results.length):0;
  return await withDb(async pool=>(await pool.query(
    'UPDATE scans SET status=$2,score=$3,results=$4::jsonb,completed_at=NOW() WHERE id=$1 RETURNING id,client_id AS "clientId",queries,status,score,results,created_at AS "createdAt",completed_at AS "completedAt"',
    [scanId,"completed",score,JSON.stringify(results)]
  )).rows[0]);
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
    'SELECT w.id,w.client_id AS "clientId",c.name AS "clientName",w.title,w.category,w.status,w.detail,w.source,w.created_at AS "createdAt",w.updated_at AS "updatedAt" FROM work_items w JOIN clients c ON c.id=w.client_id ORDER BY CASE w.status WHEN \'approval-required\' THEN 1 WHEN \'access-required\' THEN 2 WHEN \'ready\' THEN 3 WHEN \'in-progress\' THEN 4 WHEN \'completed\' THEN 5 ELSE 6 END,w.updated_at DESC LIMIT $1',
    [safe]
  )).rows)||[];
}

export async function updateWorkItem(id,status){
  const allowed=new Set(["ready","access-required","approval-required","in-progress","completed"]);
  if(!allowed.has(status))throw new Error("invalid-work-status");
  return await withDb(async pool=>(await pool.query(
    'UPDATE work_items SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING id,client_id AS "clientId",title,category,status,detail,source,created_at AS "createdAt",updated_at AS "updatedAt"',
    [id,status]
  )).rows[0])||null;
}


export async function getOrCreatePaymentIntent(clientId,plan="Starter"){
  return await withDb(async pool=>{
    let row=(await pool.query(
      "SELECT id,client_id AS \"clientId\",reference_code AS \"referenceCode\",method,status,plan,setup_amount AS \"setupAmount\",monthly_amount AS \"monthlyAmount\",created_at AS \"createdAt\",reported_at AS \"reportedAt\",paid_at AS \"paidAt\" FROM payments WHERE client_id=$1 AND status IN ('pending','customer-reported') ORDER BY created_at DESC LIMIT 1",
      [clientId]
    )).rows[0];
    if(row)return row;
    const id=crypto.randomUUID();
    const referenceCode=("AIV-"+id.slice(0,8)).toUpperCase();
    row=(await pool.query(
      'INSERT INTO payments(id,client_id,reference_code,method,status,plan) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,client_id AS "clientId",reference_code AS "referenceCode",method,status,plan,setup_amount AS "setupAmount",monthly_amount AS "monthlyAmount",created_at AS "createdAt",reported_at AS "reportedAt",paid_at AS "paidAt"',
      [id,clientId,referenceCode,"bank-transfer","pending",plan]
    )).rows[0];
    return row;
  })||null;
}

export async function reportPayment(paymentId){
  return await withDb(async pool=>(await pool.query(
    "UPDATE payments SET status='customer-reported',reported_at=NOW() WHERE id=$1 AND status='pending' RETURNING id,client_id AS \"clientId\",reference_code AS \"referenceCode\",method,status,plan,setup_amount AS \"setupAmount\",monthly_amount AS \"monthlyAmount\",created_at AS \"createdAt\",reported_at AS \"reportedAt\",paid_at AS \"paidAt\"",
    [paymentId]
  )).rows[0])||null;
}

export async function listPayments(limit=100){
  const safe=Math.max(1,Math.min(Number(limit)||100,200));
  return await withDb(async pool=>(await pool.query(
    'SELECT p.id,p.client_id AS "clientId",c.name AS "clientName",p.reference_code AS "referenceCode",p.method,p.status,p.plan,p.setup_amount AS "setupAmount",p.monthly_amount AS "monthlyAmount",p.created_at AS "createdAt",p.reported_at AS "reportedAt",p.paid_at AS "paidAt" FROM payments p JOIN clients c ON c.id=p.client_id ORDER BY CASE p.status WHEN \'customer-reported\' THEN 1 WHEN \'pending\' THEN 2 WHEN \'paid\' THEN 3 ELSE 4 END,p.created_at DESC LIMIT $1',
    [safe]
  )).rows)||[];
}

export async function confirmPayment(id,{plan,setupAmount,monthlyAmount}={}){
  const setup=Math.max(0,Math.round(Number(setupAmount)||0));
  const monthly=Math.max(0,Math.round(Number(monthlyAmount)||0));
  return await withDb(async pool=>{
    const row=(await pool.query(
      "UPDATE payments SET status='paid',plan=$2,setup_amount=$3,monthly_amount=$4,paid_at=NOW() WHERE id=$1 AND status IN ('customer-reported','pending') RETURNING id,client_id AS \"clientId\",reference_code AS \"referenceCode\",method,status,plan,setup_amount AS \"setupAmount\",monthly_amount AS \"monthlyAmount\",created_at AS \"createdAt\",reported_at AS \"reportedAt\",paid_at AS \"paidAt\"",
      [id,plan||"Starter",setup,monthly]
    )).rows[0];
    if(row)await pool.query("UPDATE clients SET plan=$2,status='active' WHERE id=$1",[row.clientId,row.plan]);
    return row||null;
  })||null;
}
