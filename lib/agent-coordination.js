import {getDatabaseUrl} from "./db";

function normalizeDatabaseUrl(rawUrl){
  if(!rawUrl)return "";
  try{
    const url=new URL(rawUrl);
    const sslmode=url.searchParams.get("sslmode");
    if(["prefer","require","verify-ca"].includes(sslmode))url.searchParams.set("sslmode","verify-full");
    return url.toString();
  }catch{return rawUrl;}
}

async function withDb(fn){
  const url=normalizeDatabaseUrl(getDatabaseUrl());
  if(!url)return null;
  const {Pool}=await import("pg");
  const pool=new Pool({connectionString:url});
  try{
    await ensure(pool);
    return await fn(pool);
  }finally{await pool.end();}
}

async function ensure(pool){
  await pool.query(`CREATE TABLE IF NOT EXISTS daily_agent_reports (
    id UUID PRIMARY KEY,
    report_date DATE NOT NULL,
    market JSONB NOT NULL DEFAULT '{}'::jsonb,
    discovered INTEGER NOT NULL DEFAULT 0,
    new_prospects INTEGER NOT NULL DEFAULT 0,
    scanned INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS agent_shared_board (
    id UUID PRIMARY KEY,
    agent TEXT NOT NULL,
    helper_agent TEXT NOT NULL DEFAULT 'Koordinatör Ajan',
    event_type TEXT NOT NULL DEFAULT 'note',
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

export const AGENT_ROSTER=[
  "Araştırma Ajanı","Görünürlük Ajanı","İçerik Ajanı","Uygulama Ajanı","Satış Ajanı","CEO Ajanı",
  "Lead Finder","Qualification Ajanı","Opportunity Ajanı","CRM Ajanı","Outreach Ajanı","Follow-up Ajanı",
  "Fiyat Ajanı","Risk Ajanı","Ödeme Ajanı","Business Diagnosis Ajanları","Business Solution Ajanları",
  "Creator Diagnosis Ajanları","Creator Solution Ajanları"
];

export async function saveDailyAgentReport(report={}){
  const finishedAt=report.finishedAt||new Date().toISOString();
  const date=finishedAt.slice(0,10);
  const row=await withDb(async pool=>(await pool.query(
    `INSERT INTO daily_agent_reports(id,report_date,market,discovered,new_prospects,scanned,completed,error_count,errors,started_at,finished_at)
     VALUES($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
     RETURNING id,report_date AS "reportDate",market,discovered,new_prospects AS "newProspects",scanned,completed,error_count AS "errorCount",errors,started_at AS "startedAt",finished_at AS "finishedAt"`,
    [crypto.randomUUID(),date,JSON.stringify(report.market||{}),Number(report.discovered)||0,Number(report.newProspects)||0,Number(report.scanned)||0,Number(report.completed)||0,(report.errors||[]).length,JSON.stringify(report.errors||[]),report.startedAt||null,finishedAt]
  )).rows[0]);
  return row||null;
}

export async function listDailyAgentReports(limit=30){
  const safe=Math.max(1,Math.min(Number(limit)||30,90));
  return await withDb(async pool=>(await pool.query(
    `SELECT id,report_date AS "reportDate",market,discovered,new_prospects AS "newProspects",scanned,completed,error_count AS "errorCount",errors,started_at AS "startedAt",finished_at AS "finishedAt"
     FROM daily_agent_reports ORDER BY report_date DESC,finished_at DESC NULLS LAST LIMIT $1`,[safe]
  )).rows)||[];
}

export async function addSharedAgentEvent({agent="Koordinatör Ajan",helperAgent="Koordinatör Ajan",eventType="note",title,detail="",payload={},status="open"}){
  if(!title)return null;
  return await withDb(async pool=>(await pool.query(
    `INSERT INTO agent_shared_board(id,agent,helper_agent,event_type,title,detail,payload,status)
     VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
     RETURNING id,agent,helper_agent AS "helperAgent",event_type AS "eventType",title,detail,payload,status,created_at AS "createdAt"`,
    [crypto.randomUUID(),agent,helperAgent,eventType,String(title),String(detail||""),JSON.stringify(payload||{}),status]
  )).rows[0])||null;
}

export async function listSharedAgentEvents(limit=80){
  const safe=Math.max(1,Math.min(Number(limit)||80,200));
  return await withDb(async pool=>(await pool.query(
    `SELECT id,agent,helper_agent AS "helperAgent",event_type AS "eventType",title,detail,payload,status,created_at AS "createdAt"
     FROM agent_shared_board ORDER BY created_at DESC LIMIT $1`,[safe]
  )).rows)||[];
}

export async function getAgentCenter(){
  const [reports,events]=await Promise.all([listDailyAgentReports(14),listSharedAgentEvents(60)]);
  const latest=reports[0]||null;
  return {latest,reports,events,roster:AGENT_ROSTER,coordinator:{name:"Koordinatör Ajan",role:"Ajanlar arası görev, bulgu ve yardım paylaşımını yönetir"}};
}
