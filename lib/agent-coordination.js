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
  await pool.query(`CREATE TABLE IF NOT EXISTS decision_audit (
    id UUID PRIMARY KEY,
    trace_id TEXT NOT NULL,
    decision_type TEXT NOT NULL DEFAULT '',
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id TEXT NOT NULL DEFAULT '',
    agent TEXT NOT NULL DEFAULT '',
    input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    policies JSONB NOT NULL DEFAULT '[]'::jsonb,
    decision JSONB NOT NULL DEFAULT '{}'::jsonb,
    rationale TEXT NOT NULL DEFAULT '',
    outcome JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS decision_audit_trace_idx ON decision_audit(trace_id,created_at)");
  await pool.query("CREATE INDEX IF NOT EXISTS decision_audit_entity_idx ON decision_audit(entity_type,entity_id,created_at DESC)");
  await pool.query(`CREATE TABLE IF NOT EXISTS truth_guard_events (
    id UUID PRIMARY KEY,
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id TEXT NOT NULL DEFAULT '',
    check_type TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'review',
    confidence INTEGER NOT NULL DEFAULT 0,
    issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS truth_guard_entity_idx ON truth_guard_events(entity_type,entity_id,created_at DESC)");
  await pool.query(`CREATE TABLE IF NOT EXISTS provider_health (
    provider TEXT PRIMARY KEY,
    checks INTEGER NOT NULL DEFAULT 0,
    successes INTEGER NOT NULL DEFAULT 0,
    failures INTEGER NOT NULL DEFAULT 0,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unknown',
    last_error TEXT NOT NULL DEFAULT '',
    last_checked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS runtime_controls (
    control_key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason TEXT NOT NULL DEFAULT '',
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cost_ledger (
    id UUID PRIMARY KEY,
    cost_type TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT '',
    operation TEXT NOT NULL DEFAULT '',
    market_key TEXT NOT NULL DEFAULT '',
    prospect_id UUID,
    amount NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    estimated BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS cost_ledger_created_idx ON cost_ledger(created_at DESC)");
  await pool.query(`CREATE TABLE IF NOT EXISTS resource_allocations (
    allocation_key TEXT PRIMARY KEY,
    scope TEXT NOT NULL DEFAULT '',
    tier TEXT NOT NULL DEFAULT 'standard',
    budget_weight NUMERIC NOT NULL DEFAULT 1,
    deep_scan_limit INTEGER NOT NULL DEFAULT 4,
    reason TEXT NOT NULL DEFAULT '',
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS learned_policies (
    policy_key TEXT PRIMARY KEY,
    policy_type TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT '',
    winner TEXT NOT NULL DEFAULT '',
    confidence NUMERIC NOT NULL DEFAULT 0,
    evidence_count INTEGER NOT NULL DEFAULT 0,
    expected_value NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'candidate',
    safe_to_apply BOOLEAN NOT NULL DEFAULT FALSE,
    rationale TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
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


export async function refreshLearnedPolicies(){
 return await withDb(async pool=>{
  const exp=(await pool.query(`SELECT variant,COUNT(*)::int n,COUNT(*) FILTER(WHERE outcome='won')::int wins,COUNT(*) FILTER(WHERE outcome IN ('reply','positive-response','won'))::int positive,COALESCE(AVG(value),0)::numeric avg_value FROM decision_outcomes GROUP BY variant ORDER BY avg_value DESC`)).rows;
  const total=exp.reduce((a,x)=>a+Number(x.n||0),0),out=[];
  if(exp.length>=2&&total>=40){
   const winner=exp[0],runner=exp[1],gap=Number(winner.avg_value)-Number(runner.avg_value),confidence=Math.min(99,Math.round((total/80)*60+Math.max(0,gap)*2));
   const safe=Number(winner.n)>=20&&Number(runner.n)>=20&&gap>=5&&confidence>=70;
   const row=(await pool.query(`INSERT INTO learned_policies(policy_key,policy_type,scope,winner,confidence,evidence_count,expected_value,status,safe_to_apply,rationale)
    VALUES('outreach-experiment','experiment','global',$1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(policy_key) DO UPDATE SET winner=$1,confidence=$2,evidence_count=$3,expected_value=$4,status=$5,safe_to_apply=$6,rationale=$7,updated_at=NOW()
    RETURNING policy_key AS "policyKey",policy_type AS "policyType",scope,winner,confidence,evidence_count AS "evidenceCount",expected_value AS "expectedValue",status,safe_to_apply AS "safeToApply",rationale`,
    [winner.variant,confidence,total,Number(winner.avg_value),safe?"validated":"candidate",safe,`Varyant ${winner.variant}, ${winner.n} sonuç; ikinci varyanta değer farkı ${gap.toFixed(2)}.`])).rows[0];out.push(row);
  }
  const markets=(await pool.query(`SELECT country,city,efficiency_score,runs FROM market_learning WHERE runs>=5 ORDER BY efficiency_score DESC LIMIT 5`)).rows;
  for(const m of markets){const conf=Math.min(95,50+Number(m.runs)*5),safe=Number(m.efficiency_score)>=45&&conf>=70,key=`market|${String(m.country).toLowerCase()}|${String(m.city).toLowerCase()}`;
   const row=(await pool.query(`INSERT INTO learned_policies(policy_key,policy_type,scope,winner,confidence,evidence_count,expected_value,status,safe_to_apply,rationale)
    VALUES($1,'market-priority',$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(policy_key) DO UPDATE SET confidence=$4,evidence_count=$5,expected_value=$6,status=$7,safe_to_apply=$8,rationale=$9,updated_at=NOW()
    RETURNING policy_key AS "policyKey",policy_type AS "policyType",scope,winner,confidence,evidence_count AS "evidenceCount",expected_value AS "expectedValue",status,safe_to_apply AS "safeToApply",rationale`,
    [key,`${m.country}/${m.city}`,m.city,conf,Number(m.runs),Number(m.efficiency_score),safe?"validated":"candidate",safe,`Pazar verimlilik skoru ${m.efficiency_score}/100; ${m.runs} öğrenme turu.`])).rows[0];out.push(row)}
  return out;
 })||[];
}
export async function listLearnedPolicies(limit=30){
 const safe=Math.max(1,Math.min(Number(limit)||30,100));
 return await withDb(async pool=>(await pool.query(`SELECT policy_key AS "policyKey",policy_type AS "policyType",scope,winner,confidence,evidence_count AS "evidenceCount",expected_value AS "expectedValue",status,safe_to_apply AS "safeToApply",rationale,updated_at AS "updatedAt" FROM learned_policies ORDER BY safe_to_apply DESC,confidence DESC,updated_at DESC LIMIT $1`,[safe])).rows)||[];
}


export async function refreshResourceAllocations(){
 return await withDb(async pool=>{
  const markets=(await pool.query(`SELECT market_key,country,city,runs,errors,efficiency_score,estimated_cost,revenue FROM market_learning ORDER BY efficiency_score DESC LIMIT 60`)).rows,out=[];
  for(const m of markets){
   const eff=Number(m.efficiency_score||0),runs=Number(m.runs||0),errors=Number(m.errors||0),cost=Number(m.estimated_cost||0),rev=Number(m.revenue||0);
   const errorRate=runs?errors/runs:0;
   let tier="standard",weight=1,limit=4,reason="Standart kaynak seviyesi.";
   if(runs>=3&&errorRate>.6){tier="protected";weight=.5;limit=2;reason="Yüksek hata oranı nedeniyle maliyet koruması."}
   else if(runs>=5&&eff>=60){tier="priority";weight=1.5;limit=7;reason="Kanıtlı yüksek pazar verimliliği."}
   else if(runs>=5&&eff<20){tier="exploration";weight=.4;limit=1;reason="Düşük verimlilik; yalnız keşif kapasitesi korunuyor."}
   if(cost>0&&rev===0&&runs>=5){weight=Math.min(weight,.5);limit=Math.min(limit,2);reason+=" Harcama var ancak doğrulanmış gelir yok."}
   const row=(await pool.query(`INSERT INTO resource_allocations(allocation_key,scope,tier,budget_weight,deep_scan_limit,reason,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,NOW()+INTERVAL '6 hours') ON CONFLICT(allocation_key) DO UPDATE SET scope=$2,tier=$3,budget_weight=$4,deep_scan_limit=$5,reason=$6,expires_at=NOW()+INTERVAL '6 hours',updated_at=NOW()
    RETURNING allocation_key AS "allocationKey",scope,tier,budget_weight AS "budgetWeight",deep_scan_limit AS "deepScanLimit",reason,expires_at AS "expiresAt"`,
    [m.market_key,`${m.country}/${m.city}`,tier,weight,limit,reason])).rows[0];out.push(row);
  }return out;
 })||[];
}
export async function listResourceAllocations(limit=50){
 const safe=Math.max(1,Math.min(Number(limit)||50,100));
 return await withDb(async pool=>(await pool.query(`SELECT allocation_key AS "allocationKey",scope,tier,budget_weight AS "budgetWeight",deep_scan_limit AS "deepScanLimit",reason,expires_at AS "expiresAt",updated_at AS "updatedAt" FROM resource_allocations WHERE expires_at IS NULL OR expires_at>NOW() ORDER BY budget_weight DESC,updated_at DESC LIMIT $1`,[safe])).rows)||[];
}


export async function recordOperationalCost(x={}){
 const amount=Number(x.amount||0);if(!Number.isFinite(amount)||amount<0)throw new Error("invalid-cost");
 return await withDb(async pool=>(await pool.query(`INSERT INTO cost_ledger(id,cost_type,provider,operation,market_key,prospect_id,amount,currency,estimated,metadata)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING id,cost_type AS "costType",provider,operation,market_key AS "marketKey",amount,currency,estimated,created_at AS "createdAt"`,
 [crypto.randomUUID(),x.costType||"api",x.provider||"",x.operation||"",x.marketKey||"",x.prospectId||null,amount,x.currency||"USD",x.estimated!==false,JSON.stringify(x.metadata||{})])).rows[0])||null;
}
export async function getProfitControlSnapshot(){
 return await withDb(async pool=>{
  const costs=(await pool.query(`SELECT currency,COALESCE(SUM(amount),0)::numeric total,COUNT(*)::int entries,COUNT(*) FILTER(WHERE estimated)::int estimated_entries FROM cost_ledger GROUP BY currency`)).rows;
  const revenue=(await pool.query(`SELECT COALESCE(currency,'') currency,COALESCE(SUM(setup_amount+monthly_amount),0)::numeric total,COUNT(*)::int payments FROM payments WHERE status='paid' GROUP BY currency`)).rows;
  const funnel=(await pool.query(`SELECT COUNT(*)::int prospects,COUNT(*) FILTER(WHERE communication_status='sent')::int contacted,COUNT(*) FILTER(WHERE crm_stage='won')::int won FROM prospects`)).rows[0];
  const byCurrency={};for(const x of costs)byCurrency[x.currency]={currency:x.currency,cost:Number(x.total),costEntries:x.entries,estimatedCostEntries:x.estimated_entries,revenue:0,payments:0};
  for(const x of revenue){if(!byCurrency[x.currency])byCurrency[x.currency]={currency:x.currency,cost:0,costEntries:0,estimatedCostEntries:0,revenue:0,payments:0};byCurrency[x.currency].revenue=Number(x.total);byCurrency[x.currency].payments=x.payments}
  const rows=Object.values(byCurrency).map(x=>({...x,contribution:Math.round((x.revenue-x.cost)*100)/100,costPerWon:funnel.won?Math.round((x.cost/funnel.won)*100)/100:null}));
  return {currencies:rows,funnel,normalizedNetProfit:null,note:"Farklı para birimleri kur dönüşümü olmadan birleştirilmez."};
 })||{currencies:[],funnel:{},normalizedNetProfit:null};
}


export async function refreshBudgetGuard(){
 return await withDb(async pool=>{
  const daily=Number(process.env.DAILY_AI_BUDGET_USD||0),monthly=Number(process.env.MONTHLY_AI_BUDGET_USD||0);
  const spend=(await pool.query(`SELECT COALESCE(SUM(amount),0)::numeric day_spend,
    COALESCE(SUM(amount) FILTER(WHERE created_at>=date_trunc('month',NOW())),0)::numeric month_spend
    FROM cost_ledger WHERE currency='USD' AND created_at>=date_trunc('month',NOW())`)).rows[0];
  const day=Number(spend.day_spend||0),month=Number(spend.month_spend||0);
  let mode="normal",multiplier=1,reason="Bütçe sınırı tanımlı değil veya güvenli aralıkta.";
  const dr=daily>0?day/daily:0,mr=monthly>0?month/monthly:0,ratio=Math.max(dr,mr);
  if(ratio>=1){mode="emergency";multiplier=.25;reason="Tanımlı AI bütçe sınırı aşıldı; pahalı keşif ve derin tarama kapasitesi %25'e indirildi."}
  else if(ratio>=.85){mode="guarded";multiplier=.5;reason="AI bütçesinin %85 eşiği aşıldı; pahalı kapasite yarıya indirildi."}
  else if(ratio>=.7){mode="caution";multiplier=.75;reason="AI bütçesinin %70 eşiği aşıldı; maliyet kontrollü kapasite uygulanıyor."}
  const value={mode,multiplier,dailyBudget:daily,monthlyBudget:monthly,daySpend:day,monthSpend:month,ratio};
  await pool.query(`INSERT INTO runtime_controls(control_key,value,reason,expires_at) VALUES('budget-guard',$1::jsonb,$2,NOW()+INTERVAL '2 hours')
   ON CONFLICT(control_key) DO UPDATE SET value=$1::jsonb,reason=$2,expires_at=NOW()+INTERVAL '2 hours',updated_at=NOW()`,[JSON.stringify(value),reason]);
  return {...value,reason};
 })||{mode:"normal",multiplier:1};
}
export async function getRuntimeControl(key){
 return await withDb(async pool=>(await pool.query(`SELECT control_key AS "controlKey",value,reason,expires_at AS "expiresAt",updated_at AS "updatedAt" FROM runtime_controls WHERE control_key=$1 AND (expires_at IS NULL OR expires_at>NOW())`,[key])).rows[0])||null;
}


export async function recordProviderHealth(x={}){
 const provider=String(x.provider||"").toLowerCase().trim();if(!provider)throw new Error("provider-required");
 const ok=Boolean(x.ok),lat=Math.max(0,Number(x.latencyMs||0)),err=String(x.error||"").slice(0,300);
 return await withDb(async pool=>{
  const prev=(await pool.query("SELECT * FROM provider_health WHERE provider=$1",[provider])).rows[0];
  const checks=Number(prev?.checks||0)+1,successes=Number(prev?.successes||0)+(ok?1:0),failures=Number(prev?.failures||0)+(ok?0:1),consecutive=ok?0:Number(prev?.consecutive_failures||0)+1;
  const avg=prev?.checks?Math.round((Number(prev.avg_latency_ms||0)*Number(prev.checks)+lat)/checks):Math.round(lat);
  const rate=checks?failures/checks:0;let status="healthy";
  if(consecutive>=3||rate>.5)status="degraded";if(consecutive>=5)status="unhealthy";if(ok&&consecutive===0&&rate<=.25)status="healthy";
  return (await pool.query(`INSERT INTO provider_health(provider,checks,successes,failures,consecutive_failures,avg_latency_ms,status,last_error,last_checked_at)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()) ON CONFLICT(provider) DO UPDATE SET checks=$2,successes=$3,failures=$4,consecutive_failures=$5,avg_latency_ms=$6,status=$7,last_error=$8,last_checked_at=NOW(),updated_at=NOW()
   RETURNING provider,checks,successes,failures,consecutive_failures AS "consecutiveFailures",avg_latency_ms AS "avgLatencyMs",status,last_error AS "lastError",last_checked_at AS "lastCheckedAt"`,
   [provider,checks,successes,failures,consecutive,avg,status,ok?"":err])).rows[0];
 })||null;
}
export async function listProviderHealth(){
 return await withDb(async pool=>(await pool.query(`SELECT provider,checks,successes,failures,consecutive_failures AS "consecutiveFailures",avg_latency_ms AS "avgLatencyMs",status,last_error AS "lastError",last_checked_at AS "lastCheckedAt" FROM provider_health ORDER BY CASE status WHEN 'healthy' THEN 0 WHEN 'unknown' THEN 1 WHEN 'degraded' THEN 2 ELSE 3 END,avg_latency_ms ASC`)).rows)||[];
}
export async function chooseHealthyProvider(candidates=[]){
 const health=await listProviderHealth(),map=new Map(health.map(x=>[x.provider,x]));
 const ranked=candidates.map(x=>({provider:x,health:map.get(String(x).toLowerCase())})).sort((a,b)=>{
  const rank=s=>s==="healthy"?0:s==="unknown"||!s?1:s==="degraded"?2:3;
  return rank(a.health?.status)-rank(b.health?.status)+((Number(a.health?.avgLatencyMs||0)-Number(b.health?.avgLatencyMs||0))/100000);
 });
 return ranked[0]?.provider||candidates[0]||null;
}


export function evaluateTruthGuard(input={}){
 const issues=[],evidence=input.evidence||{};let confidence=100;
 if(!input.name){issues.push("missing-name");confidence-=40}
 if(input.requiresSource&&!input.sourceUrl){issues.push("missing-source");confidence-=45}
 if(input.contactEmail&&!input.sourceUrl){issues.push("unverified-contact");confidence-=50}
 if(input.score!=null&&(Number(input.score)<0||Number(input.score)>100||!Number.isFinite(Number(input.score)))){issues.push("invalid-score");confidence-=60}
 if(input.claims?.length&&!input.sourceUrl&&!input.providerEvidence){issues.push("unsupported-claims");confidence-=35}
 const status=confidence>=75&&issues.length===0?"verified":confidence>=45?"review":"rejected";
 return {status,confidence:Math.max(0,confidence),issues,evidence};
}
export async function recordTruthGuardEvent(x={}){
 const check=evaluateTruthGuard(x);
 return await withDb(async pool=>(await pool.query(`INSERT INTO truth_guard_events(id,entity_type,entity_id,check_type,status,confidence,issues,evidence)
 VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) RETURNING id,entity_type AS "entityType",entity_id AS "entityId",check_type AS "checkType",status,confidence,issues,evidence,created_at AS "createdAt"`,
 [crypto.randomUUID(),x.entityType||"",String(x.entityId||""),x.checkType||"quality",check.status,check.confidence,JSON.stringify(check.issues),JSON.stringify(check.evidence||{})])).rows[0])||null;
}
export async function listTruthGuardRisks(limit=50){
 const safe=Math.max(1,Math.min(Number(limit)||50,200));
 return await withDb(async pool=>(await pool.query(`SELECT id,entity_type AS "entityType",entity_id AS "entityId",check_type AS "checkType",status,confidence,issues,evidence,created_at AS "createdAt" FROM truth_guard_events WHERE status<>'verified' ORDER BY created_at DESC LIMIT $1`,[safe])).rows)||[];
}


function redactAuditValue(v,key=""){
 const k=String(key).toLowerCase();if(["password","secret","token","authorization","apikey","api_key"].some(x=>k.includes(x)))return "[REDACTED]";
 if(typeof v==="string")return v.length>1200?v.slice(0,1200)+"…":v;
 if(Array.isArray(v))return v.slice(0,30).map(x=>redactAuditValue(x));
 if(v&&typeof v==="object"){const o={};for(const [a,b] of Object.entries(v))o[a]=redactAuditValue(b,a);return o}return v;
}
export async function recordDecisionAudit(x={}){
 const traceId=String(x.traceId||crypto.randomUUID());
 return await withDb(async pool=>(await pool.query(`INSERT INTO decision_audit(id,trace_id,decision_type,entity_type,entity_id,agent,input_snapshot,evidence,policies,decision,rationale,outcome)
 VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12::jsonb)
 RETURNING id,trace_id AS "traceId",decision_type AS "decisionType",entity_type AS "entityType",entity_id AS "entityId",agent,rationale,created_at AS "createdAt"`,
 [crypto.randomUUID(),traceId,x.decisionType||"",x.entityType||"",String(x.entityId||""),x.agent||"",JSON.stringify(redactAuditValue(x.input||{})),JSON.stringify(redactAuditValue(x.evidence||{})),JSON.stringify(redactAuditValue(x.policies||[])),JSON.stringify(redactAuditValue(x.decision||{})),String(x.rationale||"").slice(0,2000),JSON.stringify(redactAuditValue(x.outcome||{}))])).rows[0])||null;
}
export async function listDecisionAudit(limit=100){
 const safe=Math.max(1,Math.min(Number(limit)||100,300));
 return await withDb(async pool=>(await pool.query(`SELECT id,trace_id AS "traceId",decision_type AS "decisionType",entity_type AS "entityType",entity_id AS "entityId",agent,input_snapshot AS input,evidence,policies,decision,rationale,outcome,created_at AS "createdAt" FROM decision_audit ORDER BY created_at DESC LIMIT $1`,[safe])).rows)||[];
}
