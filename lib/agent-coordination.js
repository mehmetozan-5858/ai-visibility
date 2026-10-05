import {getDatabaseUrl} from "./db";
import {worldNetworkSummary} from "./world-agent-network";

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
  await pool.query(`CREATE TABLE IF NOT EXISTS market_learning (
    market_key TEXT PRIMARY KEY,
    country TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    runs INTEGER NOT NULL DEFAULT 0,
    discovered INTEGER NOT NULL DEFAULT 0,
    new_prospects INTEGER NOT NULL DEFAULT 0,
    scanned INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    score NUMERIC NOT NULL DEFAULT 50,
    estimated_cost NUMERIC NOT NULL DEFAULT 0,
    replies INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    revenue NUMERIC NOT NULL DEFAULT 0,
    efficiency_score NUMERIC NOT NULL DEFAULT 50,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query("ALTER TABLE market_learning ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE market_learning ADD COLUMN IF NOT EXISTS replies INTEGER NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE market_learning ADD COLUMN IF NOT EXISTS wins INTEGER NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE market_learning ADD COLUMN IF NOT EXISTS revenue NUMERIC NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE market_learning ADD COLUMN IF NOT EXISTS efficiency_score NUMERIC NOT NULL DEFAULT 50");
  await pool.query(`CREATE TABLE IF NOT EXISTS strategy_learning (
    strategy_key TEXT PRIMARY KEY,
    country TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    sector TEXT NOT NULL DEFAULT '',
    package TEXT NOT NULL DEFAULT '',
    prospects INTEGER NOT NULL DEFAULT 0,
    contacted INTEGER NOT NULL DEFAULT 0,
    replies INTEGER NOT NULL DEFAULT 0,
    proposals INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    revenue NUMERIC NOT NULL DEFAULT 0,
    confidence NUMERIC NOT NULL DEFAULT 0,
    strategy_score NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS autonomous_actions (
    id UUID PRIMARY KEY,
    action_key TEXT NOT NULL,
    action_type TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'applied',
    reversible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS autonomous_actions_key_idx ON autonomous_actions(action_key,created_at DESC)");
  await pool.query(`CREATE TABLE IF NOT EXISTS predictive_alerts (
    id UUID PRIMARY KEY,
    alert_key TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    recommendation TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS predictive_alerts_key_idx ON predictive_alerts(alert_key,created_at DESC)");
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
  "Global Baş Amir Ajan","Ülke Amir Ajanları","Şehir Ajan Masaları",
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
  return {
    latest,reports,events,roster:AGENT_ROSTER,
    coordinator:{name:"Global Baş Amir Ajan",role:"Ülke amirlerini, şehir masalarını ve uzman ajanlar arası görev/bulgu paylaşımını yönetir"},
    worldNetwork:worldNetworkSummary()
  };
}


export async function learnFromMarketRun(report={}){
  const markets=Array.isArray(report?.market?.markets)?report.market.markets:[report?.market].filter(Boolean);
  if(!markets.length)return [];
  return await withDb(async pool=>{
    const rows=[];
    for(const m of markets){
      const key=`${String(m.country||"").toLowerCase()}|${String(m.city||"").toLowerCase()}`;
      const share=Math.max(1,markets.length),d=Math.round((Number(report.discovered)||0)/share),n=Math.round((Number(report.newProspects)||0)/share),s=Math.round((Number(report.scanned)||0)/share),co=Math.round((Number(report.completed)||0)/share),er=Math.round((report.errors||[]).length/share);
      const quality=Math.max(0,Math.min(100,50+n*3+co*5-er*8));
      const row=(await pool.query(`
        INSERT INTO market_learning(market_key,country,city,runs,discovered,new_prospects,scanned,completed,errors,score)
        VALUES($1,$2,$3,1,$4,$5,$6,$7,$8,$9)
        ON CONFLICT(market_key) DO UPDATE SET runs=market_learning.runs+1,discovered=market_learning.discovered+$4,
          new_prospects=market_learning.new_prospects+$5,scanned=market_learning.scanned+$6,completed=market_learning.completed+$7,
          errors=market_learning.errors+$8,score=ROUND((market_learning.score*0.75+$9*0.25)::numeric,2),updated_at=NOW()
        RETURNING market_key AS "marketKey",country,city,runs,score`,[key,m.country||"",m.city||"",d,n,s,co,er,quality])).rows[0];rows.push(row);
    }return rows;
  })||[];
}

export async function listMarketLearning(limit=50){
  const safe=Math.max(1,Math.min(Number(limit)||50,100));
  return await withDb(async pool=>(await pool.query(`
    SELECT market_key AS "marketKey",country,city,runs,discovered,new_prospects AS "newProspects",scanned,completed,errors,score,estimated_cost AS "estimatedCost",replies,wins,revenue,efficiency_score AS "efficiencyScore",updated_at AS "updatedAt"
    FROM market_learning ORDER BY efficiency_score DESC,score DESC,runs DESC LIMIT $1`,[safe])).rows)||[];
}


export async function refreshMarketEconomics(){
  return await withDb(async pool=>{
    const rows=(await pool.query(`SELECT market_key,country,city,runs,discovered,new_prospects,scanned,completed,errors,score FROM market_learning`)).rows;
    const scanCost=Math.max(0,Number(process.env.ESTIMATED_DEEP_SCAN_COST)||0);
    const discoveryCost=Math.max(0,Number(process.env.ESTIMATED_DISCOVERY_RUN_COST)||0);
    const out=[];
    for(const x of rows){
      const p=(await pool.query(`SELECT COUNT(*) FILTER(WHERE COALESCE(reply_status,'')<>'')::int replies,COUNT(*) FILTER(WHERE crm_stage='won')::int wins FROM prospects WHERE lower(country)=lower($1) AND lower(city)=lower($2)`,[x.country,x.city])).rows[0];
      const rev=(await pool.query(`SELECT COALESCE(SUM(pay.setup_amount+pay.monthly_amount),0)::numeric revenue FROM payments pay JOIN clients c ON c.id=pay.client_id JOIN prospects pr ON pr.client_id=c.id WHERE pay.status='paid' AND lower(pr.country)=lower($1) AND lower(pr.city)=lower($2)`,[x.country,x.city])).rows[0];
      const cost=Number(x.runs||0)*discoveryCost+Number(x.scanned||0)*scanCost,revenue=Number(rev.revenue||0),replies=Number(p.replies||0),wins=Number(p.wins||0);
      const evidence=Math.min(1,Number(x.runs||0)/5),conversion=Math.min(100,replies*4+wins*25),roi=cost>0?Math.max(-50,Math.min(100,(revenue-cost)/cost*20)):0,errorPenalty=Math.min(40,Number(x.errors||0)*4);
      const efficiency=Math.max(0,Math.min(100,(Number(x.score)||50)*.35+conversion*.35+Math.max(0,roi)*.2-errorPenalty*.1));
      const row=(await pool.query(`UPDATE market_learning SET estimated_cost=$2,replies=$3,wins=$4,revenue=$5,efficiency_score=$6,updated_at=NOW() WHERE market_key=$1 RETURNING market_key AS "marketKey",country,city,efficiency_score AS "efficiencyScore",estimated_cost AS "estimatedCost",replies,wins,revenue`,[x.market_key,cost,replies,wins,revenue,Math.round((efficiency*(.5+.5*evidence))*100)/100])).rows[0];out.push(row);
    }return out.sort((a,b)=>Number(b.efficiencyScore)-Number(a.efficiencyScore));
  })||[];
}


export async function runPredictiveGuard(){
  return await withDb(async pool=>{
    const alerts=[],add=async(key,severity,category,title,detail,recommendation,payload={})=>{
      const recent=(await pool.query("SELECT id FROM predictive_alerts WHERE alert_key=$1 AND created_at>NOW()-INTERVAL '12 hours' LIMIT 1",[key])).rows[0];
      if(recent)return;
      const row=(await pool.query(`INSERT INTO predictive_alerts(id,alert_key,severity,category,title,detail,recommendation,payload)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id,alert_key AS "alertKey",severity,category,title,detail,recommendation,status,created_at AS "createdAt"`,
        [crypto.randomUUID(),key,severity,category,title,detail,recommendation,JSON.stringify(payload)])).rows[0];alerts.push(row);
    };
    const runs=(await pool.query(`SELECT COUNT(*)::int runs,COALESCE(SUM(error_count),0)::int errors,COALESCE(SUM(completed),0)::int completed FROM daily_agent_reports WHERE created_at>NOW()-INTERVAL '24 hours'`)).rows[0];
    if(runs.runs>=3&&runs.errors>Math.max(5,runs.completed*.5))await add("agent-error-spike","high","operations","Ajan hata oranı yükseldi",`Son 24 saatte ${runs.errors} hata / ${runs.completed} tamamlanan işlem.`,"Pahalı taramaları büyütmeden sağlayıcı ve hata aşamalarını incele.",runs);
    const funnel=(await pool.query(`SELECT COUNT(*) FILTER(WHERE communication_status='sent')::int contacted,COUNT(*) FILTER(WHERE COALESCE(reply_status,'')<>'')::int replies,COUNT(*) FILTER(WHERE crm_stage='proposal')::int proposals,COUNT(*) FILTER(WHERE crm_stage='won')::int wins FROM prospects`)).rows[0];
    if(funnel.contacted>=20&&funnel.replies/Math.max(1,funnel.contacted)<.05)await add("reply-rate-low","medium","sales","Cevap oranı düşük",`Temas ${funnel.contacted}, cevap ${funnel.replies}.`,"Mesaj, hedef pazar ve iletişim kanalı kalitesini yeniden test et; gönderim hacmini artırma.",funnel);
    const blocked=(await pool.query(`SELECT COUNT(*)::int n FROM work_items WHERE status IN ('approval-required','access-required') AND updated_at<NOW()-INTERVAL '3 days'`)).rows[0].n;
    if(blocked>0)await add("implementation-stale","medium","delivery","Uygulama işleri bekliyor",`${blocked} görev 3 günden uzun süredir erişim/onay bekliyor.`,"Müşteriden gereken erişim/onayı tek listede topla ve çözüm teslimini bloke edenleri önceliklendir.",{blocked});
    const markets=(await pool.query(`SELECT country,city,efficiency_score,estimated_cost,revenue,errors,runs FROM market_learning WHERE runs>=3 ORDER BY efficiency_score ASC LIMIT 5`)).rows;
    for(const m of markets)if(Number(m.efficiency_score)<20)await add(`market-low|${m.country}|${m.city}`,"medium","market",`${m.city} pazar verimliliği düşük`,`Verimlilik skoru ${m.efficiency_score}/100.`,"Bu pazarda pahalı derin tarama payını azalt; keşif seviyesinde veri toplamaya devam et.",m);
    return alerts;
  })||[];
}
export async function listPredictiveAlerts(limit=30){
 const safe=Math.max(1,Math.min(Number(limit)||30,100));
 return await withDb(async pool=>(await pool.query(`SELECT id,alert_key AS "alertKey",severity,category,title,detail,recommendation,payload,status,created_at AS "createdAt" FROM predictive_alerts ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,created_at DESC LIMIT $1`,[safe])).rows)||[];
}


export async function runSelfHealingDecisionEngine(){
 return await withDb(async pool=>{
  const actions=[],record=async(key,type,scope,reason,before,after,status="applied")=>{
   const recent=(await pool.query("SELECT id FROM autonomous_actions WHERE action_key=$1 AND created_at>NOW()-INTERVAL '12 hours' LIMIT 1",[key])).rows[0];if(recent)return;
   const row=(await pool.query(`INSERT INTO autonomous_actions(id,action_key,action_type,scope,reason,before_state,after_state,status,reversible)
    VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,TRUE) RETURNING id,action_key AS "actionKey",action_type AS "actionType",scope,reason,before_state AS "beforeState",after_state AS "afterState",status,reversible,created_at AS "createdAt"`,
    [crypto.randomUUID(),key,type,scope,reason,JSON.stringify(before||{}),JSON.stringify(after||{}),status])).rows[0];actions.push(row);
  };
  const bad=(await pool.query(`SELECT market_key,country,city,efficiency_score,errors,runs FROM market_learning WHERE runs>=3 AND efficiency_score<20 ORDER BY efficiency_score ASC LIMIT 8`)).rows;
  for(const m of bad)await record(`deprioritize|${m.market_key}`,"market-deprioritize",m.market_key,"Düşük ekonomik verimlilik nedeniyle pahalı analiz kapasitesi azaltılmalı.",m,{priority:"exploration-only"},"recommended");
  const health=(await pool.query(`SELECT COUNT(*)::int runs,COALESCE(SUM(error_count),0)::int errors,COALESCE(SUM(completed),0)::int completed FROM daily_agent_reports WHERE created_at>NOW()-INTERVAL '6 hours'`)).rows[0];
  if(health.runs>=2&&health.errors>Math.max(6,health.completed))await record("global-cost-brake","cost-brake","global","Hata yükü tamamlanan iş sayısını aştı; pahalı derin taramalar geçici olarak daraltılmalı.",health,{deepScanMode:"reduced"},"recommended");
  const blocked=(await pool.query(`SELECT COUNT(*)::int n FROM work_items WHERE status IN ('approval-required','access-required') AND updated_at<NOW()-INTERVAL '3 days'`)).rows[0].n;
  if(blocked>0)await record("delivery-escalation","delivery-escalation","implementation",`${blocked} uzun bekleyen uygulama görevi var.`,{blocked},{route:"CEO-review"},"recommended");
  return actions;
 })||[];
}
export async function listAutonomousActions(limit=30){
 const safe=Math.max(1,Math.min(Number(limit)||30,100));
 return await withDb(async pool=>(await pool.query(`SELECT id,action_key AS "actionKey",action_type AS "actionType",scope,reason,before_state AS "beforeState",after_state AS "afterState",status,reversible,created_at AS "createdAt" FROM autonomous_actions ORDER BY created_at DESC LIMIT $1`,[safe])).rows)||[];
}


export async function refreshStrategyLearning(){
 return await withDb(async pool=>{
  const groups=(await pool.query(`
   SELECT COALESCE(country,'') country,COALESCE(city,'') city,COALESCE(sector,'') sector,COALESCE(proposal_package,'') package,
    COUNT(*)::int prospects,COUNT(*) FILTER(WHERE communication_status='sent')::int contacted,
    COUNT(*) FILTER(WHERE COALESCE(reply_status,'')<>'')::int replies,
    COUNT(*) FILTER(WHERE COALESCE(proposal_package,'')<>'')::int proposals,
    COUNT(*) FILTER(WHERE crm_stage='won')::int wins
   FROM prospects GROUP BY 1,2,3,4`)).rows;
  const out=[];
  for(const g of groups){
   const rev=(await pool.query(`SELECT COALESCE(SUM(pay.setup_amount+pay.monthly_amount),0)::numeric revenue
    FROM payments pay JOIN clients c ON c.id=pay.client_id JOIN prospects p ON p.client_id=c.id
    WHERE pay.status='paid' AND COALESCE(p.country,'')=$1 AND COALESCE(p.city,'')=$2 AND COALESCE(p.sector,'')=$3 AND COALESCE(p.proposal_package,'')=$4`,
    [g.country,g.city,g.sector,g.package])).rows[0];
   const n=Number(g.prospects||0),contacted=Number(g.contacted||0),replies=Number(g.replies||0),proposals=Number(g.proposals||0),wins=Number(g.wins||0),revenue=Number(rev.revenue||0);
   const confidence=Math.min(100,Math.round(Math.sqrt(n)*20));
   const replyRate=contacted?replies/contacted:0,winRate=proposals?wins/proposals:0;
   const raw=Math.min(100,replyRate*30+winRate*50+Math.min(20,revenue/1000));
   const score=Math.round(raw*(confidence/100)*100)/100,key=[g.country,g.city,g.sector,g.package].map(x=>String(x).toLowerCase()).join("|");
   const row=(await pool.query(`INSERT INTO strategy_learning(strategy_key,country,city,sector,package,prospects,contacted,replies,proposals,wins,revenue,confidence,strategy_score)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT(strategy_key) DO UPDATE SET prospects=$6,contacted=$7,replies=$8,proposals=$9,wins=$10,revenue=$11,confidence=$12,strategy_score=$13,updated_at=NOW()
    RETURNING strategy_key AS "strategyKey",country,city,sector,package,prospects,contacted,replies,proposals,wins,revenue,confidence,strategy_score AS "strategyScore"`,
    [key,g.country,g.city,g.sector,g.package,n,contacted,replies,proposals,wins,revenue,confidence,score])).rows[0];out.push(row);
  }return out.sort((a,b)=>Number(b.strategyScore)-Number(a.strategyScore));
 })||[];
}
export async function listStrategyLearning(limit=40){
 const safe=Math.max(1,Math.min(Number(limit)||40,100));
 return await withDb(async pool=>(await pool.query(`SELECT strategy_key AS "strategyKey",country,city,sector,package,prospects,contacted,replies,proposals,wins,revenue,confidence,strategy_score AS "strategyScore",updated_at AS "updatedAt" FROM strategy_learning ORDER BY strategy_score DESC,confidence DESC LIMIT $1`,[safe])).rows)||[];
}
