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
  await pool.query(`CREATE TABLE IF NOT EXISTS innovation_hypotheses (
    id UUID PRIMARY KEY,
    hypothesis_key TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    problem TEXT NOT NULL,
    proposed_capability TEXT NOT NULL,
    differentiation TEXT NOT NULL DEFAULT '',
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence_count INTEGER NOT NULL DEFAULT 0,
    confidence NUMERIC NOT NULL DEFAULT 0,
    customer_value NUMERIC NOT NULL DEFAULT 0,
    defensibility NUMERIC NOT NULL DEFAULT 0,
    feasibility NUMERIC NOT NULL DEFAULT 0,
    innovation_score NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'hypothesis',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS innovation_hypotheses_score_idx ON innovation_hypotheses(innovation_score DESC,updated_at DESC)");
  await pool.query(`CREATE TABLE IF NOT EXISTS benchmark_signals (
    id UUID PRIMARY KEY,
    category TEXT NOT NULL,
    competitor TEXT NOT NULL DEFAULT '',
    signal TEXT NOT NULL,
    source_url TEXT NOT NULL DEFAULT '',
    source_date TEXT NOT NULL DEFAULT '',
    confidence NUMERIC NOT NULL DEFAULT 0,
    relevance NUMERIC NOT NULL DEFAULT 0,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'observed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS benchmark_signals_rank_idx ON benchmark_signals(relevance DESC,created_at DESC)");
  await pool.query(`CREATE TABLE IF NOT EXISTS improvement_backlog (
    improvement_key TEXT PRIMARY KEY,
    pillar TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 50,
    current_score NUMERIC NOT NULL DEFAULT 0,
    target_score NUMERIC NOT NULL DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'open',
    recommended_action TEXT NOT NULL DEFAULT '',
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS dependency_incidents (
    id UUID PRIMARY KEY,
    incident_key TEXT NOT NULL,
    root_component TEXT NOT NULL DEFAULT '',
    affected_components JSONB NOT NULL DEFAULT '[]'::jsonb,
    severity TEXT NOT NULL DEFAULT 'warning',
    status TEXT NOT NULL DEFAULT 'open',
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    diagnosis TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS dependency_incidents_status_idx ON dependency_incidents(status,updated_at DESC)");
  await pool.query(`CREATE TABLE IF NOT EXISTS system_watchdog (
    component_key TEXT PRIMARY KEY,
    component_type TEXT NOT NULL DEFAULT 'cycle',
    last_seen_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_status TEXT NOT NULL DEFAULT 'unknown',
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    expected_interval_minutes INTEGER NOT NULL DEFAULT 60,
    severity TEXT NOT NULL DEFAULT 'normal',
    detail TEXT NOT NULL DEFAULT '',
    recovery_attempts INTEGER NOT NULL DEFAULT 0,
    last_recovery_at TIMESTAMPTZ,
    quarantine_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query("ALTER TABLE system_watchdog ADD COLUMN IF NOT EXISTS recovery_attempts INTEGER NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE system_watchdog ADD COLUMN IF NOT EXISTS last_recovery_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE system_watchdog ADD COLUMN IF NOT EXISTS quarantine_until TIMESTAMPTZ");
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
    [crypto.randomUUID(),key,type,scope,reason,JSON.stringify(before||{}),JSON.stringify(after||{}),status])).rows[0];actions.push(row);await recordDecisionAudit({decisionType:"self-healing-recommendation",entityType:"system",entityId:scope,agent:"Self-Healing Decision Engine",input:before||{},decision:{actionType:type,...(after||{}),status},rationale:reason,outcome:{reversible:true}}).catch(()=>null);
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
   await recordDecisionAudit({decisionType:"learned-policy",entityType:"policy",entityId:"outreach-experiment",agent:"Policy Brain",input:{variants:exp,total},evidence:{winnerCount:Number(winner.n),runnerCount:Number(runner.n),gap},decision:{winner:winner.variant,confidence,status:safe?"validated":"candidate",safeToApply:safe},rationale:row.rationale}).catch(()=>null);
  }
  const markets=(await pool.query(`SELECT country,city,efficiency_score,runs FROM market_learning WHERE runs>=5 ORDER BY efficiency_score DESC LIMIT 5`)).rows;
  for(const m of markets){const conf=Math.min(95,50+Number(m.runs)*5),safe=Number(m.efficiency_score)>=45&&conf>=70,key=`market|${String(m.country).toLowerCase()}|${String(m.city).toLowerCase()}`;
   const row=(await pool.query(`INSERT INTO learned_policies(policy_key,policy_type,scope,winner,confidence,evidence_count,expected_value,status,safe_to_apply,rationale)
    VALUES($1,'market-priority',$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(policy_key) DO UPDATE SET confidence=$4,evidence_count=$5,expected_value=$6,status=$7,safe_to_apply=$8,rationale=$9,updated_at=NOW()
    RETURNING policy_key AS "policyKey",policy_type AS "policyType",scope,winner,confidence,evidence_count AS "evidenceCount",expected_value AS "expectedValue",status,safe_to_apply AS "safeToApply",rationale`,
    [key,`${m.country}/${m.city}`,m.city,conf,Number(m.runs),Number(m.efficiency_score),safe?"validated":"candidate",safe,`Pazar verimlilik skoru ${m.efficiency_score}/100; ${m.runs} öğrenme turu.`])).rows[0];out.push(row);
   await recordDecisionAudit({decisionType:"learned-policy",entityType:"market",entityId:key,agent:"Policy Brain",input:{runs:Number(m.runs),efficiencyScore:Number(m.efficiency_score)},decision:{winner:m.city,confidence:conf,status:safe?"validated":"candidate",safeToApply:safe},rationale:row.rationale}).catch(()=>null);
  }
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
    [m.market_key,`${m.country}/${m.city}`,tier,weight,limit,reason])).rows[0];
   await recordDecisionAudit({decisionType:"resource-allocation",entityType:"market",entityId:m.market_key,agent:"Resource Orchestrator",input:{runs,errorRate,efficiency:eff,estimatedCost:cost,revenue:rev},evidence:{market:`${m.country}/${m.city}`},decision:{tier,budgetWeight:weight,deepScanLimit:limit},rationale:reason}).catch(()=>null);
   out.push(row);
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
  await recordDecisionAudit({decisionType:"budget-guard",entityType:"system",entityId:"ai-budget",agent:"Budget Guard",input:{dailyBudget:daily,monthlyBudget:monthly,daySpend:day,monthSpend:month},evidence:{dailyRatio:dr,monthlyRatio:mr},decision:{mode,multiplier},rationale:reason,outcome:{customerServicePaused:false}}).catch(()=>null);
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


export async function heartbeatComponent(x={}){
 const key=String(x.key||"").trim();if(!key)throw new Error("component-key-required");const ok=x.ok!==false;
 return await withDb(async pool=>(await pool.query(`INSERT INTO system_watchdog(component_key,component_type,last_seen_at,last_success_at,last_status,consecutive_failures,expected_interval_minutes,severity,detail)
 VALUES($1,$2,NOW(),CASE WHEN $3 THEN NOW() ELSE NULL END,$4,CASE WHEN $3 THEN 0 ELSE 1 END,$5,CASE WHEN $3 THEN 'normal' ELSE 'warning' END,$6)
 ON CONFLICT(component_key) DO UPDATE SET component_type=$2,last_seen_at=NOW(),last_success_at=CASE WHEN $3 THEN NOW() ELSE system_watchdog.last_success_at END,last_status=$4,consecutive_failures=CASE WHEN $3 THEN 0 ELSE system_watchdog.consecutive_failures+1 END,expected_interval_minutes=$5,severity=CASE WHEN $3 THEN 'normal' WHEN system_watchdog.consecutive_failures+1>=3 THEN 'critical' ELSE 'warning' END,detail=$6,updated_at=NOW()
 RETURNING component_key AS "componentKey",last_status AS "lastStatus",consecutive_failures AS "consecutiveFailures",severity,last_seen_at AS "lastSeenAt",last_success_at AS "lastSuccessAt"`,
 [key,x.type||"cycle",ok,ok?"healthy":"failed",Math.max(5,Number(x.expectedIntervalMinutes)||60),String(x.detail||"").slice(0,500)])).rows[0])||null;
}
export async function runSystemWatchdog(){
 return await withDb(async pool=>{
  const stale=(await pool.query(`SELECT component_key,component_type,last_success_at,expected_interval_minutes,consecutive_failures,severity,detail FROM system_watchdog WHERE last_success_at IS NULL OR last_success_at < NOW()-(expected_interval_minutes*2 || ' minutes')::interval ORDER BY severity DESC,last_success_at NULLS FIRST`)).rows;
  const critical=stale.filter(x=>Number(x.consecutive_failures)>=3||!x.last_success_at);
  for(const x of stale)await recordDecisionAudit({decisionType:"watchdog-detection",entityType:"system-component",entityId:x.component_key,agent:"System Watchdog",input:{lastSuccessAt:x.last_success_at,expectedIntervalMinutes:x.expected_interval_minutes,consecutiveFailures:x.consecutive_failures},decision:{status:critical.includes(x)?"critical":"stale",action:"safe-retry-or-alert"},rationale:"Expected component heartbeat is outside the allowed freshness window."}).catch(()=>null);
  return {stale,critical};
 })||{stale:[],critical:[]};
}
export async function listSystemWatchdog(){
 return await withDb(async pool=>(await pool.query(`SELECT component_key AS "componentKey",component_type AS "componentType",last_seen_at AS "lastSeenAt",last_success_at AS "lastSuccessAt",last_status AS "lastStatus",consecutive_failures AS "consecutiveFailures",expected_interval_minutes AS "expectedIntervalMinutes",severity,detail,recovery_attempts AS "recoveryAttempts",last_recovery_at AS "lastRecoveryAt",quarantine_until AS "quarantineUntil" FROM system_watchdog ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,updated_at DESC`)).rows)||[];
}


const SAFE_RECOVERY_ROUTES={
 "daily-cycle":"/api/cron/daily-cycle",
 "provider-health-cycle":"/api/provider-health-cycle",
 "predictive-guard-cycle":"/api/predictive-guard",
 "resource-orchestrator-cycle":"/api/resource-orchestrator-cycle",
 "budget-guard-cycle":"/api/budget-guard-cycle",
 "truth-guard-cycle":"/api/truth-guard-cycle",
 "profit-control-cycle":"/api/profit-control-cycle",
 "opportunity-forecast-cycle":"/api/opportunity-forecast-cycle",
 "next-best-action-cycle":"/api/next-best-action-cycle",
 "outcome-learning-cycle":"/api/outcome-learning-cycle",
 "policy-brain-cycle":"/api/policy-brain-cycle",
 "self-healing-cycle":"/api/self-healing-cycle"
};
export async function planSafeRecoveries(){
 return await withDb(async pool=>{
  const rows=(await pool.query(`SELECT component_key,last_success_at,expected_interval_minutes,consecutive_failures,recovery_attempts,last_recovery_at,quarantine_until FROM system_watchdog
   WHERE (last_success_at IS NULL OR last_success_at<NOW()-(expected_interval_minutes*2 || ' minutes')::interval)
   AND (quarantine_until IS NULL OR quarantine_until<NOW())`)).rows,out=[];
  for(const x of rows){
   const route=SAFE_RECOVERY_ROUTES[x.component_key];if(!route)continue;
   const attempts=Number(x.recovery_attempts||0);
   if(attempts>=3){await pool.query("UPDATE system_watchdog SET quarantine_until=NOW()+INTERVAL '6 hours',severity='critical',detail='Auto-recovery limit reached; quarantined for CEO review',updated_at=NOW() WHERE component_key=$1",[x.component_key]);continue}
   if(x.last_recovery_at&&Date.now()-new Date(x.last_recovery_at).getTime()<30*60*1000)continue;
   out.push({componentKey:x.component_key,route,attempt:attempts+1});
  }return out;
 })||[];
}
export async function markRecoveryAttempt(componentKey,{ok,detail=""}={}){
 return await withDb(async pool=>(await pool.query(`UPDATE system_watchdog SET recovery_attempts=CASE WHEN $2 THEN 0 ELSE recovery_attempts+1 END,last_recovery_at=NOW(),severity=CASE WHEN $2 THEN 'normal' WHEN recovery_attempts+1>=3 THEN 'critical' ELSE 'warning' END,detail=$3,updated_at=NOW() WHERE component_key=$1 RETURNING component_key AS "componentKey",recovery_attempts AS "recoveryAttempts",severity`,[componentKey,Boolean(ok),String(detail).slice(0,500)])).rows[0])||null;
}


const COMPONENT_DEPENDENCIES={
 "daily-cycle":["provider-health-cycle"],
 "opportunity-forecast-cycle":["daily-cycle"],
 "next-best-action-cycle":["daily-cycle"],
 "outcome-learning-cycle":["next-best-action-cycle"],
 "policy-brain-cycle":["outcome-learning-cycle"],
 "resource-orchestrator-cycle":["daily-cycle","profit-control-cycle"],
 "self-healing-cycle":["predictive-guard-cycle","resource-orchestrator-cycle"],
 "implementation-cycle":["provider-health-cycle"],
 "remeasurement-cycle":["provider-health-cycle"]
};
export async function diagnoseDependencyIncidents(){
 return await withDb(async pool=>{
  const rows=(await pool.query(`SELECT component_key,last_success_at,consecutive_failures,severity,expected_interval_minutes FROM system_watchdog`)).rows;
  const map=Object.fromEntries(rows.map(x=>[x.component_key,x])),now=Date.now(),bad=new Set();
  for(const x of rows){const age=x.last_success_at?(now-new Date(x.last_success_at).getTime())/60000:Infinity;if(age>Number(x.expected_interval_minutes||60)*2||Number(x.consecutive_failures)>=2)bad.add(x.component_key)}
  const incidents=[];
  for(const [child,deps] of Object.entries(COMPONENT_DEPENDENCIES)){if(!bad.has(child))continue;const roots=deps.filter(d=>bad.has(d));if(!roots.length)continue;
   for(const root of roots){const affected=[child,...Object.entries(COMPONENT_DEPENDENCIES).filter(([k,v])=>bad.has(k)&&v.includes(root)).map(([k])=>k)].filter((v,i,a)=>a.indexOf(v)===i);
    const key=`dependency|${root}`,severity=Number(map[root]?.consecutive_failures||0)>=3?"critical":"warning",diagnosis=`${root} sağlıksız; ${affected.length} bağlı motor etkileniyor. Alt motorları ayrı ayrı zorlamak yerine kök bileşen öncelikli onarılmalı.`;
    const existing=(await pool.query("SELECT id FROM dependency_incidents WHERE incident_key=$1 AND status='open' LIMIT 1",[key])).rows[0];
    const id=existing?.id||crypto.randomUUID();
    if(existing)await pool.query("UPDATE dependency_incidents SET affected_components=$2::jsonb,severity=$3,evidence=$4::jsonb,diagnosis=$5,updated_at=NOW() WHERE id=$1",[id,JSON.stringify(affected),severity,JSON.stringify({root:map[root]||{},bad:[...bad]}),diagnosis]);
    else await pool.query("INSERT INTO dependency_incidents(id,incident_key,root_component,affected_components,severity,status,evidence,diagnosis) VALUES($1,$2,$3,$4::jsonb,$5,'open',$6::jsonb,$7)",[id,key,root,JSON.stringify(affected),severity,JSON.stringify({root:map[root]||{},bad:[...bad]}),diagnosis]);
    await recordDecisionAudit({decisionType:"root-cause-diagnosis",entityType:"system-component",entityId:root,agent:"Dependency Brain",input:{bad:[...bad]},evidence:{dependencies:COMPONENT_DEPENDENCIES},decision:{rootComponent:root,affected,severity},rationale:diagnosis}).catch(()=>null);
    incidents.push({id,rootComponent:root,affected,severity,diagnosis});
   }
  }
  return incidents;
 })||[];
}
export async function listDependencyIncidents(limit=30){
 const safe=Math.max(1,Math.min(Number(limit)||30,100));
 return await withDb(async pool=>(await pool.query(`SELECT id,incident_key AS "incidentKey",root_component AS "rootComponent",affected_components AS "affectedComponents",severity,status,diagnosis,created_at AS "createdAt",updated_at AS "updatedAt" FROM dependency_incidents WHERE status='open' ORDER BY CASE severity WHEN 'critical' THEN 0 ELSE 1 END,updated_at DESC LIMIT $1`,[safe])).rows)||[];
}


export async function buildMissionControlSnapshot(){
 return await withDb(async pool=>{
  const health=(await pool.query(`SELECT component_key,severity,last_success_at,consecutive_failures FROM system_watchdog`)).rows;
  const incidents=(await pool.query(`SELECT root_component,severity,affected_components FROM dependency_incidents WHERE status='open' ORDER BY updated_at DESC LIMIT 30`)).rows;
  const critical=health.filter(x=>x.severity==="critical"),warning=health.filter(x=>x.severity==="warning");
  const profit=await getProfitControlSnapshot().catch(()=>({currencies:[]}));
  const guard=await refreshBudgetGuard().catch(()=>({mode:"unknown",multiplier:1,reason:"Budget snapshot unavailable"}));
  const opportunities=(await pool.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE opportunity_probability>=50)::int AS high FROM prospects`)).rows[0]||{total:0,high:0};
  let mode="growth",priority="qualified-growth";
  if(critical.length||incidents.some(x=>x.severity==="critical")){mode="protect";priority="system-integrity"}
  else if(guard.mode==="emergency"||guard.mode==="guarded"){mode="protect";priority="cost-control"}
  else if(Number(opportunities.high||0)>0){mode="convert";priority="high-probability-sales"}
  else if(warning.length){mode="stabilize";priority="reliability"}
  const rationale=mode==="protect"?"Önce kritik sistem/maliyet riski azaltılacak.":mode==="convert"?"Mevcut yüksek olasılıklı fırsatlar satışa çevrilecek.":mode==="stabilize"?"Büyüme sürerken uyarı veren motorlar stabilize edilecek.":"Sağlık ve bütçe izin verdiği için nitelikli büyüme öncelikli.";
  const snapshot={mode,priority,rationale,health:{critical:critical.length,warning:warning.length,total:health.length},incidents:incidents.length,budget:{mode:guard.mode,multiplier:guard.multiplier,reason:guard.reason},opportunities:{total:Number(opportunities.total||0),high:Number(opportunities.high||0)},profit};
  await recordDecisionAudit({decisionType:"mission-control",entityType:"system",entityId:"mega-machine",agent:"Mission Control Brain",input:{health:snapshot.health,budget:snapshot.budget,opportunities:snapshot.opportunities},evidence:{openDependencyIncidents:incidents.length},decision:{mode,priority},rationale}).catch(()=>null);
  return snapshot;
 })||{};
}


export async function buildWorldClassScorecard(){
 return await withDb(async pool=>{
  const health=(await pool.query(`SELECT component_key,severity,last_success_at,expected_interval_minutes FROM system_watchdog`)).rows;
  const truth=(await pool.query(`SELECT status,COUNT(*)::int AS n FROM truth_guard_events WHERE created_at>NOW()-INTERVAL '7 days' GROUP BY status`)).rows;
  const audit=(await pool.query(`SELECT COUNT(*)::int AS n FROM decision_audit WHERE created_at>NOW()-INTERVAL '7 days'`)).rows[0]?.n||0;
  const prospects=(await pool.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE qualification_level IN ('warm','hot'))::int AS qualified,COUNT(*) FILTER(WHERE crm_status='won')::int AS won FROM prospects`)).rows[0]||{};
  const now=Date.now(),healthy=health.filter(x=>x.last_success_at&&(now-new Date(x.last_success_at).getTime())/60000<=Number(x.expected_interval_minutes||60)*2&&x.severity!=="critical").length;
  const healthScore=health.length?Math.round(healthy/health.length*100):0;
  const truthTotal=truth.reduce((a,x)=>a+Number(x.n||0),0),truthVerified=truth.find(x=>x.status==="verified")?.n||0,truthScore=truthTotal?Math.round(Number(truthVerified)/truthTotal*100):100;
  const observabilityScore=Math.min(100,Math.round(Number(audit)/5));
  const qualified=Number(prospects.qualified||0),won=Number(prospects.won||0),conversionScore=qualified?Math.min(100,Math.round(won/qualified*100*5)):0;
  const pillars={reliability:healthScore,truth:truthScore,explainability:observabilityScore,commercialProof:conversionScore};
  const score=Math.round(Object.values(pillars).reduce((a,b)=>a+b,0)/4);
  const gaps=Object.entries(pillars).sort((a,b)=>a[1]-b[1]).slice(0,3).map(([pillar,value])=>({pillar,value}));
  const result={score,pillars,gaps,metrics:{components:health.length,sevenDayAudits:Number(audit),prospects:Number(prospects.total||0),qualified,won},principle:"Dünya liderliği iddiası değil; ölçülebilir mühendislik ve ticari kanıt hedefidir."};
  await recordDecisionAudit({decisionType:"world-class-scorecard",entityType:"system",entityId:"mega-machine",agent:"Mission Control Brain",input:result.metrics,evidence:{pillars},decision:{score,gaps},rationale:"En zayıf ölçülebilir sütunlar bir sonraki geliştirme önceliğini belirler."}).catch(()=>null);
  return result;
 })||{};
}


const SCORECARD_ACTIONS={
 reliability:"Kritik döngülerin heartbeat, failover, timeout ve güvenli kurtarma kapsamasını artır.",
 truth:"Kaynak doğrulama ve kanıt zorunluluğunu daha fazla satış/analiz adımına uygula.",
 explainability:"Karar zincirlerinde ortak trace id ve daha güçlü kanıt/audit bağlantısı kur.",
 commercialProof:"Nitelikli adaydan gerçek müşteri ve gelir dönüşümünü ölç; CRM zincirindeki kayıpları azalt."
};
export async function refreshImprovementBacklog(){
 const scorecard=await buildWorldClassScorecard();
 return await withDb(async pool=>{
  const out=[];
  for(const [pillar,value] of Object.entries(scorecard.pillars||{})){
   const priority=Math.max(1,100-Number(value||0)),key=`world-class|${pillar}`,action=SCORECARD_ACTIONS[pillar]||"Ölçülebilir kalite açığını azalt.";
   await pool.query(`INSERT INTO improvement_backlog(improvement_key,pillar,priority,current_score,target_score,status,recommended_action,evidence,updated_at)
    VALUES($1,$2,$3,$4,100,'open',$5,$6::jsonb,NOW())
    ON CONFLICT(improvement_key) DO UPDATE SET priority=EXCLUDED.priority,current_score=EXCLUDED.current_score,recommended_action=EXCLUDED.recommended_action,evidence=EXCLUDED.evidence,status=CASE WHEN EXCLUDED.current_score>=95 THEN 'watch' ELSE 'open' END,updated_at=NOW()`,
    [key,pillar,priority,value,action,JSON.stringify({scorecardScore:scorecard.score,metrics:scorecard.metrics})]);
   out.push({key,pillar,priority,currentScore:value,targetScore:100,recommendedAction:action,status:Number(value)>=95?"watch":"open"});
  }
  return out.sort((a,b)=>b.priority-a.priority);
 })||[];
}
export async function listImprovementBacklog(limit=20){
 const safe=Math.max(1,Math.min(Number(limit)||20,100));
 return await withDb(async pool=>(await pool.query(`SELECT improvement_key AS "key",pillar,priority,current_score AS "currentScore",target_score AS "targetScore",status,recommended_action AS "recommendedAction",updated_at AS "updatedAt" FROM improvement_backlog ORDER BY priority DESC,updated_at DESC LIMIT $1`,[safe])).rows)||[];
}


export async function saveBenchmarkSignals(signals=[]){
 return await withDb(async pool=>{
  const out=[];
  for(const s of signals.slice(0,50)){
   if(!s?.signal||!s?.sourceUrl)continue;
   const id=crypto.randomUUID(),confidence=Math.max(0,Math.min(100,Number(s.confidence)||0)),relevance=Math.max(0,Math.min(100,Number(s.relevance)||0));
   await pool.query(`INSERT INTO benchmark_signals(id,category,competitor,signal,source_url,source_date,confidence,relevance,evidence,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,[id,String(s.category||"market").slice(0,80),String(s.competitor||"").slice(0,120),String(s.signal).slice(0,1000),String(s.sourceUrl).slice(0,1000),String(s.sourceDate||"").slice(0,40),confidence,relevance,JSON.stringify(s.evidence||{}),confidence>=70?"verified-signal":"review"]);
   out.push({id,...s,confidence,relevance});
  }
  return out;
 })||[];
}
export async function listBenchmarkSignals(limit=50){
 const safe=Math.max(1,Math.min(Number(limit)||50,100));
 return await withDb(async pool=>(await pool.query(`SELECT id,category,competitor,signal,source_url AS "sourceUrl",source_date AS "sourceDate",confidence,relevance,status,created_at AS "createdAt" FROM benchmark_signals ORDER BY relevance DESC,confidence DESC,created_at DESC LIMIT $1`,[safe])).rows)||[];
}


export async function refreshBenchmarkGapBacklog(){
 return await withDb(async pool=>{
  const signals=(await pool.query(`SELECT category,competitor,signal,source_url,confidence,relevance FROM benchmark_signals WHERE status='verified-signal' AND created_at>NOW()-INTERVAL '30 days' ORDER BY relevance DESC,confidence DESC LIMIT 100`)).rows;
  const grouped={};for(const s of signals){const k=String(s.category||"market").toLowerCase();(grouped[k]||(grouped[k]=[])).push(s)}
  const out=[];
  for(const [category,items] of Object.entries(grouped)){
   const avg=Math.round(items.reduce((a,x)=>a+Number(x.relevance||0),0)/items.length),confidence=Math.round(items.reduce((a,x)=>a+Number(x.confidence||0),0)/items.length);
   if(items.length<2||confidence<70)continue;
   const priority=Math.min(100,Math.round(avg*.7+confidence*.3)),key=`benchmark|${category}`;
   const action=`Benchmark gap review: ${category} alanındaki doğrulanmış dış sinyalleri mevcut ürün yetenekleriyle karşılaştır; yalnız kanıtlanan ve müşteri değeri olan farkları yol haritasına al.`;
   await pool.query(`INSERT INTO improvement_backlog(improvement_key,pillar,priority,current_score,target_score,status,recommended_action,evidence,updated_at)
    VALUES($1,$2,$3,0,100,'review',$4,$5::jsonb,NOW())
    ON CONFLICT(improvement_key) DO UPDATE SET priority=EXCLUDED.priority,status='review',recommended_action=EXCLUDED.recommended_action,evidence=EXCLUDED.evidence,updated_at=NOW()`,
    [key,`benchmark:${category}`,priority,action,JSON.stringify({signalCount:items.length,averageConfidence:confidence,averageRelevance:avg,sources:items.slice(0,8).map(x=>({competitor:x.competitor,signal:x.signal,sourceUrl:x.source_url}))})]);
   out.push({key,category,priority,signalCount:items.length,confidence,recommendedAction:action});
  }
  await recordDecisionAudit({decisionType:"benchmark-gap-prioritization",entityType:"system",entityId:"mega-machine",agent:"Improvement Brain",input:{verifiedSignals:signals.length},evidence:{groups:Object.keys(grouped).length},decision:{gaps:out.slice(0,10)},rationale:"Only repeated, high-confidence external signals become review candidates; no external claim is auto-implemented."}).catch(()=>null);
  return out.sort((a,b)=>b.priority-a.priority);
 })||[];
}


export async function generateWhiteSpaceHypotheses(){
 return await withDb(async pool=>{
  const signals=(await pool.query(`SELECT category,competitor,signal,source_url,confidence,relevance FROM benchmark_signals WHERE status='verified-signal' AND created_at>NOW()-INTERVAL '45 days' ORDER BY relevance DESC LIMIT 120`)).rows;
  const categories={};for(const s of signals){const k=String(s.category||"market").toLowerCase();(categories[k]||(categories[k]=[])).push(s)}
  const ideas=[];
  for(const [category,items] of Object.entries(categories)){
   if(items.length<2)continue;
   const avgConfidence=items.reduce((a,x)=>a+Number(x.confidence||0),0)/items.length,avgRelevance=items.reduce((a,x)=>a+Number(x.relevance||0),0)/items.length;
   if(avgConfidence<70)continue;
   const problem=`Doğrulanmış ${category} sinyalleri pazarda yoğunlaşma gösteriyor; yalnız görünürlük raporu yerine ölçümden ticari sonuca kadar kapalı döngü değer üretme fırsatı araştırılmalı.`;
   const capability=`${category} için kanıt → teşhis → çözüm → yeniden ölçüm → ticari sonuç zincirini tek izlenebilir akışta birleştiren farklılaştırılmış yetenek hipotezi.`;
   const customerValue=Math.min(100,Math.round(avgRelevance)),defensibility=Math.min(100,55+Math.min(30,items.length*5)),feasibility=75,score=Math.round(customerValue*.4+defensibility*.35+feasibility*.25),key=`whitespace|${category}`;
   const evidence={sources:items.slice(0,10).map(x=>({competitor:x.competitor,signal:x.signal,sourceUrl:x.source_url})),note:"Bu kayıt doğrulanmış bir pazar üstünlüğü değil, kanıta dayalı test edilmesi gereken ürün hipotezidir."};
   await pool.query(`INSERT INTO innovation_hypotheses(id,hypothesis_key,category,problem,proposed_capability,differentiation,evidence,evidence_count,confidence,customer_value,defensibility,feasibility,innovation_score,status)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,'hypothesis')
    ON CONFLICT(hypothesis_key) DO UPDATE SET problem=EXCLUDED.problem,proposed_capability=EXCLUDED.proposed_capability,differentiation=EXCLUDED.differentiation,evidence=EXCLUDED.evidence,evidence_count=EXCLUDED.evidence_count,confidence=EXCLUDED.confidence,customer_value=EXCLUDED.customer_value,defensibility=EXCLUDED.defensibility,feasibility=EXCLUDED.feasibility,innovation_score=EXCLUDED.innovation_score,updated_at=NOW()`,
    [crypto.randomUUID(),key,category,problem,capability,"Rakip özelliğini kopyalamak yerine uçtan uca ölçülebilir müşteri sonucu ve açıklanabilir otonomi.",JSON.stringify(evidence),items.length,Math.round(avgConfidence),customerValue,defensibility,feasibility,score]);
   ideas.push({key,category,problem,proposedCapability:capability,innovationScore:score,evidenceCount:items.length});
  }
  await recordDecisionAudit({decisionType:"white-space-innovation",entityType:"system",entityId:"mega-machine",agent:"Innovation Brain",input:{verifiedSignals:signals.length},evidence:{categories:Object.keys(categories).length},decision:{hypotheses:ideas.slice(0,10)},rationale:"Innovation candidates are hypotheses grounded in repeated external signals; they require validation before implementation."}).catch(()=>null);
  return ideas.sort((a,b)=>b.innovationScore-a.innovationScore);
 })||[];
}
export async function listInnovationHypotheses(limit=30){
 const safe=Math.max(1,Math.min(Number(limit)||30,100));
 return await withDb(async pool=>(await pool.query(`SELECT hypothesis_key AS "key",category,problem,proposed_capability AS "proposedCapability",differentiation,evidence_count AS "evidenceCount",confidence,customer_value AS "customerValue",defensibility,feasibility,innovation_score AS "innovationScore",status,updated_at AS "updatedAt" FROM innovation_hypotheses ORDER BY innovation_score DESC,updated_at DESC LIMIT $1`,[safe])).rows)||[];
}
