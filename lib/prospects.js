import {nicheFit,NICHE_PATTERN} from "./niche-targeting";
import {databasePool,initializeSchema} from "./database-runtime";
import {recordTruthGuardEvent,evaluateTruthGuard,recordDecisionAudit,recordDecisionAuditBatch} from "./agent-coordination";
import {getDatabaseUrl} from "./db";

function normalizeDatabaseUrl(rawUrl){
  if(!rawUrl)return "";
  try{
    const url=new URL(rawUrl);
    const sslmode=url.searchParams.get("sslmode");
    if(["prefer","require","verify-ca"].includes(sslmode))url.searchParams.set("sslmode","verify-full");
    return url.toString();
  }catch{return rawUrl}
}

async function db(fn){
 const url=normalizeDatabaseUrl(getDatabaseUrl());if(!url)return null;
 const p=databasePool(url);await initializeSchema(p,"prospects",async client=>{
    await client.query(`CREATE TABLE IF NOT EXISTS prospects(
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL DEFAULT '',
      sector TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT 'Türkiye',
      source TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'new',
      score INTEGER,
      reason TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Türkiye'");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS qualification_score INTEGER");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS qualification_level TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS qualification_reason TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_url TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_source_url TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_status TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_reason TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_draft TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_status TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS proposal_package TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS proposal_currency TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS proposal_amount INTEGER");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS proposal_reason TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS proposal_status TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS communication_status TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS communication_prepared_at TIMESTAMPTZ");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reply_status TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS communication_sent_at TIMESTAMPTZ");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS communication_provider_id TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS crm_stage TEXT NOT NULL DEFAULT 'new'");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS follow_up_count INTEGER NOT NULL DEFAULT 0");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMPTZ");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reply_classification TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reply_summary TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reply_draft TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reply_needs_human BOOLEAN NOT NULL DEFAULT FALSE");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reply_received_at TIMESTAMPTZ");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS client_id UUID");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_link_status TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_link_created_at TIMESTAMPTZ");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_best_action TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_best_action_reason TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_best_action_priority INTEGER NOT NULL DEFAULT 0");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_best_action_at TIMESTAMPTZ");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS experiment_variant TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS experiment_assigned_at TIMESTAMPTZ");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outcome_label TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outcome_recorded_at TIMESTAMPTZ");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS opportunity_probability INTEGER NOT NULL DEFAULT 0");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS opportunity_value NUMERIC NOT NULL DEFAULT 0");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS opportunity_priority INTEGER NOT NULL DEFAULT 0");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS opportunity_forecast_reason TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS opportunity_forecast_at TIMESTAMPTZ");
    await client.query(`CREATE TABLE IF NOT EXISTS decision_outcomes(
      id UUID PRIMARY KEY,prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
      decision TEXT NOT NULL,variant TEXT NOT NULL DEFAULT '',outcome TEXT NOT NULL,
      value NUMERIC NOT NULL DEFAULT 0,metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS visibility_scans(
      id UUID PRIMARY KEY,
      prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'queued',
      score INTEGER,
      summary TEXT NOT NULL DEFAULT '',
      findings JSONB NOT NULL DEFAULT '[]'::jsonb,
      recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
      provider TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )`);
 });
 return await fn(p);
}

export async function listProspects(){
  return await db(async p=>(await p.query(`SELECT p.id,p.name,p.domain,p.sector,p.city,p.country,p.source,p.status,p.score,p.reason,
    p.qualification_score AS "qualificationScore",p.qualification_level AS "qualificationLevel",p.qualification_reason AS "qualificationReason",p.created_at AS "createdAt",
    (SELECT vs.status FROM visibility_scans vs WHERE vs.prospect_id=p.id ORDER BY vs.created_at DESC LIMIT 1) AS "scanStatus"
    FROM prospects p
    ORDER BY COALESCE(p.qualification_score,0) DESC,
      CASE p.qualification_level WHEN 'hot' THEN 0 WHEN 'warm' THEN 1 ELSE 2 END,
      p.created_at DESC`)).rows)||[]
}

export async function addProspect(x){
  const id=crypto.randomUUID();
  const r=await db(async p=>(await p.query(
    'INSERT INTO prospects(id,name,domain,sector,city,country,source) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,domain,sector,city,country,source,status,score,reason,created_at AS "createdAt"',
    [id,x.name,x.domain,x.sector,x.city,x.country||"Türkiye",x.source]
  )).rows[0]);
  return r||{id,...x,status:"demo-only"}
}

export async function seedProspects(items=[]){
  const out=[];
  for(const x of items){
    const existing=await db(async p=>(await p.query(
      'SELECT id,name,domain,sector,city,country,source,status,score,reason,created_at AS "createdAt" FROM prospects WHERE lower(name)=lower($1) LIMIT 1',[x.name]
    )).rows[0]);
    if(existing){out.push(existing);continue}
    out.push(await addProspect(x))
  }
  return out
}

const HIGH_VALUE_MARKETS=new Set(["united states","united kingdom","germany","france","netherlands","canada","united arab emirates","saudi arabia","singapore","australia","japan","austria","switzerland","hong kong"]);
const STRONG_FIT=["sağlık","klinik","diş","otel","turizm","emlak","gayrimenkul","otomotiv","güzellik","e-ticaret","hukuk","eğitim","yazılım","teknoloji","fitness","restoran"];
export async function qualifyProspect(prospectId){
  return await db(async p=>{
    const x=(await p.query("SELECT * FROM prospects WHERE id=$1",[prospectId])).rows[0];if(!x)return null;
    let score=10,reasons=[];const country=String(x.country||"").toLowerCase(),sector=String(x.sector||"").toLowerCase();
    if(x.domain){score+=25;reasons.push("doğrulanabilir web/domain")}
    if(x.source){score+=10;reasons.push("kamusal keşif kaynağı")}
    if(HIGH_VALUE_MARKETS.has(country)){score+=20;reasons.push("yüksek ticari değerli pazar")}else if(country==="türkiye"||country==="turkey"){score+=15;reasons.push("öncelikli Türkiye pazarı")}
    if(nicheFit(sector,x.source)){score+=25;reasons.push("öncelikli uzman B2B nişi; ihtiyaç analizi ayrıca doğrulanır")}
    if(STRONG_FIT.some(s=>sector.includes(s))){score+=20;reasons.push("çözüm satılabilirliği güçlü sektör")}
    const productionFit=["üretim","makine","endüstriyel","metal","çelik","döküm","plastik","kauçuk","ambalaj","otomotiv yan sanayi","kimya","yapı malzem","medikal","elektronik","tekstil","konfeksiyon"];
    if(productionFit.some(s=>sector.includes(s))){score+=15;reasons.push("üretici / B2B görünürlük potansiyeli")}
    const commercialText=[sector,x.name||"",x.source||"",x.reason||""].join(" ").toLocaleLowerCase("tr-TR");
    const exportSignals=["ihracat","export","international","global","distribütör","distributor","wholesale","toptan","b2b"];
    if(exportSignals.some(s=>commercialText.includes(s))){score+=10;reasons.push("doğrulanabilir ihracat / B2B büyüme sinyali")}
    if(x.domain&&productionFit.some(s=>sector.includes(s))){score+=5;reasons.push("üretici + kurumsal web varlığı: satın alma adayı")}
    score=Math.max(0,Math.min(100,score));const level=score>=70?"hot":score>=45?"warm":"low";
    return (await p.query("UPDATE prospects SET qualification_score=$2,qualification_level=$3,qualification_reason=$4 WHERE id=$1 RETURNING id,name,qualification_score AS \"qualificationScore\",qualification_level AS \"qualificationLevel\",qualification_reason AS \"qualificationReason\"",[prospectId,score,level,reasons.join(" · ")||"sınırlı doğrulanabilir satış sinyali"])).rows[0]
  })
}

export async function queueProspectScan(prospectId){
  const id=crypto.randomUUID();
  const row=await db(async p=>{
    const exists=(await p.query('SELECT id FROM prospects WHERE id=$1',[prospectId])).rows[0];
    if(!exists){const e=new Error("prospect-not-found");e.code="P404";throw e}
    const r=(await p.query(
      'INSERT INTO visibility_scans(id,prospect_id,status) VALUES($1,$2,$3) RETURNING id,prospect_id AS "prospectId",status,score,summary,findings,recommendations,provider,created_at AS "createdAt",completed_at AS "completedAt"',
      [id,prospectId,"awaiting-provider"]
    )).rows[0];
    await p.query('UPDATE prospects SET status=$2 WHERE id=$1',[prospectId,"analysis-queued"]);
    return r;
  });
  return row||{id,prospectId,status:"demo-only"};
}

export async function getProspect(prospectId){
  return await db(async p=>(await p.query('SELECT id,name,domain,sector,city,country,source,status,score,reason,created_at AS "createdAt" FROM prospects WHERE id=$1',[prospectId])).rows[0])||null
}

export async function completeProspectScan(scanId,prospectId,result){
  const truth=evaluateTruthGuard({name:"visibility-scan",score:result?.score,providerEvidence:Boolean(result?.provider),claims:[...(result?.findings||[]),...(result?.recommendations||[])]});
  await recordTruthGuardEvent({entityType:"prospect",entityId:prospectId,checkType:"visibility-scan",name:"visibility-scan",score:result?.score,providerEvidence:Boolean(result?.provider),claims:[...(result?.findings||[]),...(result?.recommendations||[])],evidence:{provider:result?.provider||""}}).catch(()=>null);
  await recordDecisionAudit({decisionType:"visibility-scan-quality",entityType:"prospect",entityId:prospectId,agent:"Truth Guard",input:{score:result?.score,provider:result?.provider||""},evidence:{provider:result?.provider||"",findings:result?.findings||[]},decision:{status:truth.status,confidence:truth.confidence},rationale:truth.issues.length?`Quality issues: ${truth.issues.join(", ")}`:"Scan passed evidence and structure checks."}).catch(()=>null);
  if(truth.status==="rejected")throw new Error("truth-guard-rejected-scan");
  return await db(async p=>{
    const r=(await p.query(
      'UPDATE visibility_scans SET status=$2,score=$3,summary=$4,findings=$5::jsonb,recommendations=$6::jsonb,provider=$7,completed_at=NOW() WHERE id=$1 RETURNING id,prospect_id AS "prospectId",status,score,summary,findings,recommendations,provider,created_at AS "createdAt",completed_at AS "completedAt"',
      [scanId,"completed",result.score,result.summary||"",JSON.stringify(result.findings||[]),JSON.stringify(result.recommendations||[]),result.provider||""]
    )).rows[0];
    await p.query('UPDATE prospects SET status=$2,score=$3,reason=$4 WHERE id=$1',[prospectId,"analyzed",result.score,result.reason||""]);
    return r;
  });
}


export async function markProspectConverted(prospectId,score=null,reason=""){
  return await db(async p=>(await p.query(
    'UPDATE prospects SET status=$2,score=COALESCE($3,score),reason=CASE WHEN $4<>\'\' THEN $4 ELSE reason END WHERE id=$1 RETURNING id,name,domain,sector,city,source,status,score,reason,created_at AS "createdAt"',
    [prospectId,"converted",score,reason||""]
  )).rows[0])||null;
}


export async function getProspectNames(){
  const rows=await db(async p=>(await p.query('SELECT name FROM prospects ORDER BY created_at DESC LIMIT 500')).rows)||[];
  return rows.map(x=>x.name).filter(Boolean);
}


export async function saveProspectContact(prospectId,contact={}){
  const truth=evaluateTruthGuard({name:"contact",requiresSource:contact.status==="verified",sourceUrl:contact.sourceUrl,contactEmail:contact.email});
  const safeStatus=contact.status==="verified"&&truth.status==="verified"?"verified":"not-found";
  await recordTruthGuardEvent({entityType:"prospect",entityId:prospectId,checkType:"contact",name:"contact",requiresSource:contact.status==="verified",sourceUrl:contact.sourceUrl,contactEmail:contact.email,evidence:{contactUrl:contact.contactUrl||"",sourceUrl:contact.sourceUrl||""}}).catch(()=>null);
  await recordDecisionAudit({decisionType:"contact-verification",entityType:"prospect",entityId:prospectId,agent:"Truth Guard",input:{claimedStatus:contact.status,email:contact.email||"",contactUrl:contact.contactUrl||""},evidence:{sourceUrl:contact.sourceUrl||""},decision:{status:safeStatus},rationale:safeStatus==="verified"?"Public source evidence passed verification.":"Contact was not allowed into verified sales flow because evidence was insufficient."}).catch(()=>null);
  return await db(async p=>(await p.query(
    `UPDATE prospects SET contact_email=$2,contact_url=$3,contact_source_url=$4,contact_status=$5 WHERE id=$1 RETURNING id,name,contact_email AS "contactEmail",contact_url AS "contactUrl",contact_source_url AS "contactSourceUrl",contact_status AS "contactStatus"`,
    [prospectId,safeStatus==="verified"?(contact.email||""):"",safeStatus==="verified"?(contact.contactUrl||""):"",safeStatus==="verified"?(contact.sourceUrl||""):"",safeStatus]
  )).rows[0])||null
}


export async function saveProspectPersonalization(prospectId,x={}){
  return await db(async p=>(await p.query(
    `UPDATE prospects SET outreach_reason=$2,outreach_draft=$3,outreach_status=$4 WHERE id=$1 RETURNING id,name,outreach_reason AS "outreachReason",outreach_draft AS "outreachDraft",outreach_status AS "outreachStatus"`,
    [prospectId,x.reason||"",x.draft||"",x.status||"drafted"]
  )).rows[0])||null
}


export async function saveProspectProposal(prospectId,x={}){
  return await db(async p=>(await p.query(
    `UPDATE prospects SET proposal_package=$2,proposal_currency=$3,proposal_amount=$4,proposal_reason=$5,proposal_status=$6 WHERE id=$1 RETURNING id,name,proposal_package AS "proposalPackage",proposal_currency AS "proposalCurrency",proposal_amount AS "proposalAmount",proposal_reason AS "proposalReason",proposal_status AS "proposalStatus"`,
    [prospectId,x.package||"",x.currency||"",Number.isFinite(Number(x.amount))?Number(x.amount):null,x.reason||"",x.status||"drafted"]
  )).rows[0])||null
}


export async function listCommunicationQueue(limit=100){
  return await db(async p=>(await p.query(`
    SELECT id,name,domain,sector,city,country,
      qualification_score AS "qualificationScore",qualification_level AS "qualificationLevel",
      contact_email AS "contactEmail",contact_url AS "contactUrl",contact_source_url AS "contactSourceUrl",contact_status AS "contactStatus",
      outreach_reason AS "outreachReason",outreach_draft AS "outreachDraft",outreach_status AS "outreachStatus",
      proposal_package AS "proposalPackage",proposal_currency AS "proposalCurrency",proposal_amount AS "proposalAmount",proposal_reason AS "proposalReason",proposal_status AS "proposalStatus",
      created_at AS "createdAt"
    FROM prospects
    WHERE contact_status='verified' AND outreach_status='drafted' AND proposal_status='drafted'
      AND communication_status='ready-for-review'
    ORDER BY (sector ~* $2 OR source LIKE 'specialist-evidence: %') DESC, qualification_score DESC NULLS LAST, created_at DESC LIMIT $1`,[Math.max(1,Math.min(Number(limit)||100,200)),NICHE_PATTERN])).rows)||[]
}

// Read the entire uncontacted pool before choosing recipients; no first-100 bias.
export async function listOutreachEvaluationCandidates(){
 return await db(async p=>(await p.query(`SELECT p.id,p.name,p.domain,p.sector,p.city,p.country,p.source,p.status,p.created_at AS "createdAt",
  p.qualification_score AS "qualificationScore",p.qualification_level AS "qualificationLevel",
  p.contact_email AS "contactEmail",p.contact_source_url AS "contactSourceUrl",p.contact_status AS "contactStatus",
  p.outreach_status AS "outreachStatus",p.proposal_status AS "proposalStatus",p.communication_status AS "communicationStatus",
  p.reply_status AS "replyStatus",p.crm_stage AS "crmStage",p.client_id AS "clientId",
  vs.score AS "scanScore",vs.provider AS "scanProvider",vs.findings AS "scanFindings",vs.recommendations AS "scanRecommendations",
  (SELECT MAX(attempt.created_at) FROM visibility_scans attempt WHERE attempt.prospect_id=p.id) AS "scanAttemptAt"
  FROM prospects p LEFT JOIN LATERAL (SELECT score,provider,findings,recommendations FROM visibility_scans
   WHERE prospect_id=p.id AND status='completed' ORDER BY completed_at DESC NULLS LAST,created_at DESC LIMIT 1) vs ON TRUE
  WHERE COALESCE(p.reply_status,'')='' AND p.client_id IS NULL AND p.crm_stage NOT IN ('lost','won')
   AND p.communication_status NOT IN ('sent','follow-up-due') ORDER BY p.created_at,p.id`)).rows)||[];
}


export async function prepareProspectCommunication(prospectId){
  return await db(async p=>(await p.query(
    `UPDATE prospects SET communication_status='ready-for-review',communication_prepared_at=NOW()
     WHERE id=$1 AND contact_status='verified' AND outreach_status='drafted' AND proposal_status='drafted'
     RETURNING id,name,communication_status AS "communicationStatus",communication_prepared_at AS "communicationPreparedAt"`,
    [prospectId]
  )).rows[0])||null
}

export async function listFollowUpQueue(limit=100){
  return await db(async p=>(await p.query(`
    SELECT id,name,domain,country,contact_email AS "contactEmail",contact_url AS "contactUrl",
      follow_up_count AS "followUpCount",communication_status AS "communicationStatus",follow_up_at AS "followUpAt",reply_status AS "replyStatus",
      outreach_draft AS "outreachDraft",proposal_package AS "proposalPackage",proposal_currency AS "proposalCurrency",proposal_amount AS "proposalAmount"
    FROM prospects
    WHERE communication_status IN ('sent','follow-up-due') AND COALESCE(reply_status,'')=''
      AND follow_up_count<2 AND follow_up_at IS NOT NULL AND follow_up_at<=NOW()
      AND contact_status='verified' AND contact_email<>'' AND crm_stage<>'lost'
    ORDER BY follow_up_at ASC NULLS FIRST LIMIT $1`,[Math.max(1,Math.min(Number(limit)||100,200))])).rows)||[]
}


export async function markProspectCommunicationSent(prospectId,providerId=""){
  return await db(async p=>(await p.query(
    `UPDATE prospects SET communication_status='sent',communication_sent_at=NOW(),communication_provider_id=$2,
      crm_stage='contacted',follow_up_at=NOW()+INTERVAL '4 days'
     WHERE id=$1 AND communication_status='ready-for-review'
     RETURNING id,name,communication_status AS "communicationStatus",communication_sent_at AS "communicationSentAt",follow_up_at AS "followUpAt"`,
    [prospectId,providerId||""]
  )).rows[0])||null
}


export async function getCommunicationProspect(prospectId){
  return await db(async p=>(await p.query(`
    SELECT id,name,domain,sector,city,country,qualification_score AS "qualificationScore",
      contact_email AS "contactEmail",contact_url AS "contactUrl",contact_source_url AS "contactSourceUrl",contact_status AS "contactStatus",
      outreach_reason AS "outreachReason",outreach_draft AS "outreachDraft",outreach_status AS "outreachStatus",
      proposal_package AS "proposalPackage",proposal_currency AS "proposalCurrency",proposal_amount AS "proposalAmount",proposal_reason AS "proposalReason",proposal_status AS "proposalStatus",
      communication_status AS "communicationStatus",reply_status AS "replyStatus",crm_stage AS "crmStage",
      client_id AS "clientId",payment_link_status AS "paymentLinkStatus"
    FROM prospects WHERE id=$1`,[prospectId])).rows[0])||null
}


export async function markProspectFollowUpSent(prospectId,expectedCount){
  return await db(async p=>(await p.query(`
    UPDATE prospects SET communication_status='sent',crm_stage='contacted',
      follow_up_count=follow_up_count+1,last_follow_up_at=NOW(),
      follow_up_at=CASE WHEN follow_up_count+1<2 THEN NOW()+INTERVAL '5 days' ELSE NULL END
    WHERE id=$1 AND COALESCE(reply_status,'')='' AND follow_up_count<2 AND follow_up_count=$2
    RETURNING id,name,follow_up_count AS "followUpCount",follow_up_at AS "followUpAt",crm_stage AS "crmStage"`,[prospectId,expectedCount])).rows[0])||null
}

export async function updateProspectReply(prospectId,status){
  const allowed=new Set(["replied","interested","not-interested","meeting","proposal","won","lost"]);
  if(!allowed.has(status))throw new Error("invalid-reply-status");
  const stage={replied:"replied",interested:"warm","not-interested":"lost",meeting:"meeting",proposal:"proposal",won:"won",lost:"lost"}[status];
  return await db(async p=>(await p.query(`
    UPDATE prospects SET reply_status=$2,crm_stage=$3,follow_up_at=NULL
    WHERE id=$1 RETURNING id,name,reply_status AS "replyStatus",crm_stage AS "crmStage"`,[prospectId,status,stage])).rows[0])||null
}


export async function saveProspectReplyAnalysis(prospectId,x={}){
  const status=x.crmStatus||"replied";
  const allowed=new Set(["replied","interested","meeting","lost"]);if(!allowed.has(status))throw new Error("invalid-reply-status");
  const stage={replied:"replied",interested:"warm",meeting:"meeting",lost:"lost"}[status];
  return await db(async p=>(await p.query(`
    UPDATE prospects SET reply_status=$2,crm_stage=$3,follow_up_at=NULL,
      reply_classification=$4,reply_summary=$5,reply_draft=$6,reply_needs_human=$7,reply_received_at=NOW()
    WHERE id=$1
    RETURNING id,name,reply_status AS "replyStatus",crm_stage AS "crmStage",reply_classification AS "replyClassification",
      reply_summary AS "replySummary",reply_draft AS "replyDraft",reply_needs_human AS "replyNeedsHuman",reply_received_at AS "replyReceivedAt"`,
    [prospectId,status,stage,x.classification||"other",x.summary||"",x.draftReply||"",Boolean(x.needsHuman)]
  )).rows[0])||null
}


export async function linkProspectToClient(prospectId,clientId){
  return await db(async p=>(await p.query(`
    UPDATE prospects SET client_id=$2,crm_stage='proposal',payment_link_status='ready',payment_link_created_at=NOW()
    WHERE id=$1 RETURNING id,name,client_id AS "clientId",crm_stage AS "crmStage",payment_link_status AS "paymentLinkStatus"`,
    [prospectId,clientId]
  )).rows[0])||null
}

export async function markProspectWonByClient(clientId){
  return await db(async p=>(await p.query(`
    UPDATE prospects SET crm_stage='won',reply_status='won',payment_link_status='paid',follow_up_at=NULL
    WHERE client_id=$1 RETURNING id,name,crm_stage AS "crmStage",payment_link_status AS "paymentLinkStatus"`,[clientId])).rows[0])||null
}


export async function refreshNextBestActions(limit=300){
 return await db(async p=>{
  const rows=(await p.query(`SELECT id,name,qualification_score,qualification_level,contact_status,outreach_status,proposal_status,communication_status,reply_status,reply_classification,reply_needs_human,crm_stage,client_id,payment_link_status,follow_up_at,follow_up_count FROM prospects ORDER BY created_at DESC LIMIT $1`,[Math.max(1,Math.min(Number(limit)||300,1000))])).rows,out=[];
  for(const x of rows){
   let action="observe",reason="Yeni kanıt bekleniyor.",priority=10;
   if(x.crm_stage==="won"){action="retain-and-remeasure";reason="Müşteri kazanıldı; çözüm sonucu ve yeniden ölçüm takip edilmeli.";priority=55}
   else if(x.reply_needs_human){action="human-review";reason="Cevap insan değerlendirmesi gerektiriyor.";priority=100}
   else if(x.reply_status==="interested"||x.crm_stage==="warm"){action="prepare-payment-handoff";reason="Doğrulanmış ilgi var; ödeme/teklif geçişi hazırlanmalı.";priority=90}
   else if(x.crm_stage==="meeting"){action="prepare-meeting";reason="Görüşme talebi/evresi var; insan onaylı görüşme hazırlığı gerekli.";priority=88}
   else if(x.reply_status==="lost"||x.crm_stage==="lost"){action="stop-contact";reason="Olumsuz yanıt/kayıp durumu; yeni iletişim yapılmamalı.";priority=95}
   else if(x.communication_status==="sent"&&!x.reply_status&&x.follow_up_at&&new Date(x.follow_up_at)<=new Date()&&Number(x.follow_up_count||0)<2){action="follow-up-review";reason="Yanıt yok ve takip zamanı geldi.";priority=70}
   else if(x.communication_status==="ready-for-review"){action="communication-review";reason="Doğrulanmış iletişim paketi gönderim öncesi kontrolde.";priority=65}
   else if(x.contact_status==="verified"&&x.proposal_status==="drafted"){action="prepare-communication";reason="Kanal ve teklif hazır; kişisel iletişim paketi tamamlanmalı.";priority=60}
   else if((x.qualification_level==="hot"||x.qualification_level==="warm")&&x.contact_status!=="verified"){action="find-public-contact";reason="Nitelikli aday için doğrulanmış kamusal iletişim kanalı gerekli.";priority=50}
   else if(Number(x.qualification_score||0)>=45){action="deep-analysis";reason="Nitelikli aday; kanıta dayalı derin analiz öncelikli.";priority=45}
   await p.query(`UPDATE prospects SET next_best_action=$2,next_best_action_reason=$3,next_best_action_priority=$4,next_best_action_at=NOW() WHERE id=$1`,[x.id,action,reason,priority]);
   await recordDecisionAudit({decisionType:"next-best-action",entityType:"prospect",entityId:x.id,agent:"Next Best Action",input:{qualificationScore:x.qualification_score,qualificationLevel:x.qualification_level,contactStatus:x.contact_status,communicationStatus:x.communication_status,replyStatus:x.reply_status,crmStage:x.crm_stage,followUpCount:x.follow_up_count},decision:{action,priority},rationale:reason}).catch(()=>null);
   out.push({id:x.id,name:x.name,action,reason,priority});
  }return out.sort((a,b)=>b.priority-a.priority);
 })||[];
}
export async function listNextBestActions(limit=100){
 return await db(async p=>(await p.query(`SELECT id,name,country,city,sector,crm_stage AS "crmStage",next_best_action AS "action",next_best_action_reason AS "reason",next_best_action_priority AS "priority",next_best_action_at AS "evaluatedAt" FROM prospects WHERE COALESCE(next_best_action,'')<>'' ORDER BY next_best_action_priority DESC,next_best_action_at DESC LIMIT $1`,[Math.max(1,Math.min(Number(limit)||100,300))])).rows)||[];
}


function stableVariant(id){let h=0;for(const ch of String(id||""))h=(h*31+ch.charCodeAt(0))>>>0;return h%2===0?"A":"B"}
export async function refreshOutcomeExperiments(limit=500){
 return await db(async p=>{
  const rows=(await p.query(`SELECT id,name,next_best_action,experiment_variant,communication_status,reply_status,crm_stage,payment_link_status FROM prospects ORDER BY created_at DESC LIMIT $1`,[Math.max(1,Math.min(Number(limit)||500,1000))])).rows,out=[];
  for(const x of rows){
   const variant=x.experiment_variant||stableVariant(x.id);
   if(!x.experiment_variant)await p.query("UPDATE prospects SET experiment_variant=$2,experiment_assigned_at=NOW() WHERE id=$1",[x.id,variant]);
   let outcome="";
   if(x.crm_stage==="won"||x.payment_link_status==="paid")outcome="won";
   else if(x.crm_stage==="lost"||x.reply_status==="lost"||x.reply_status==="not-interested")outcome="lost";
   else if(x.reply_status==="interested"||x.crm_stage==="warm"||x.crm_stage==="meeting")outcome="positive-response";
   else if(x.reply_status==="replied")outcome="reply";
   if(outcome){
    const exists=(await p.query("SELECT id FROM decision_outcomes WHERE prospect_id=$1 AND decision=$2 AND outcome=$3 LIMIT 1",[x.id,x.next_best_action||"unknown",outcome])).rows[0];
    if(!exists)await p.query(`INSERT INTO decision_outcomes(id,prospect_id,decision,variant,outcome,value,metadata) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[crypto.randomUUID(),x.id,x.next_best_action||"unknown",variant,outcome,outcome==="won"?100:outcome==="positive-response"?25:outcome==="reply"?10:-10,JSON.stringify({crmStage:x.crm_stage,replyStatus:x.reply_status})]);
    await p.query("UPDATE prospects SET outcome_label=$2,outcome_recorded_at=NOW() WHERE id=$1",[x.id,outcome]);
   }out.push({id:x.id,name:x.name,variant,outcome:outcome||"pending"});
  }return out;
 })||[];
}
export async function getExperimentPerformance(){
 return await db(async p=>(await p.query(`
  SELECT variant,COUNT(*)::int outcomes,
   COUNT(*) FILTER(WHERE outcome IN ('reply','positive-response','won'))::int positive,
   COUNT(*) FILTER(WHERE outcome='won')::int wins,
   ROUND(AVG(value)::numeric,2) AS "avgValue"
  FROM decision_outcomes GROUP BY variant ORDER BY variant`)).rows)||[];
}


export async function refreshOpportunityForecasts(limit=700){
 return await db(async p=>{
  const rows=(await p.query(`SELECT id,name,country,city,sector,score,qualification_score,qualification_level,contact_status,communication_status,reply_status,crm_stage,proposal_amount,proposal_currency,payment_link_status FROM prospects ORDER BY created_at DESC LIMIT $1`,[Math.max(1,Math.min(Number(limit)||700,1500))])).rows,out=[],audits=[];
  for(const x of rows){
   let prob=5,reasons=[];
   const q=Number(x.qualification_score||0),vis=Number(x.score||0);
   prob+=Math.min(25,Math.round(q*.25));if(q>=70)reasons.push("yüksek nitelik");
   if(x.contact_status==="verified"){prob+=8;reasons.push("doğrulanmış iletişim")}
   if(x.communication_status==="sent")prob+=7;
   if(x.reply_status==="replied"){prob+=12;reasons.push("cevap verdi")}
   if(x.reply_status==="interested"||x.crm_stage==="warm"){prob+=28;reasons.push("doğrulanmış ilgi")}
   if(x.crm_stage==="meeting"){prob+=32;reasons.push("görüşme aşaması")}
   if(x.crm_stage==="proposal"){prob+=38;reasons.push("teklif aşaması")}
   if(x.payment_link_status==="ready"){prob+=8;reasons.push("ödeme geçişi hazır")}
   if(x.crm_stage==="won"||x.payment_link_status==="paid")prob=100;
   if(x.crm_stage==="lost"||x.reply_status==="lost"||x.reply_status==="not-interested")prob=0;
   if(vis>0&&vis<55){prob+=5;reasons.push("çözüm ihtiyacı güçlü")}
   prob=Math.max(0,Math.min(100,prob));
   const amount=Number(x.proposal_amount||0),expected=Math.round(amount*(prob/100)*100)/100;
   const priority=Math.max(0,Math.min(100,Math.round(prob*.75+Math.min(25,expected/1000))));
   const reason=reasons.join(" · ")||"sınırlı satış sinyali";
   audits.push({decisionType:"opportunity-forecast",entityType:"prospect",entityId:x.id,agent:"Opportunity Forecast Brain",input:{qualificationScore:q,visibilityScore:vis,contactStatus:x.contact_status,communicationStatus:x.communication_status,replyStatus:x.reply_status,crmStage:x.crm_stage,proposalAmount:amount,proposalCurrency:x.proposal_currency||""},decision:{probability:prob,expectedValue:expected,currency:x.proposal_currency||"",priority},rationale:reason});
   out.push({id:x.id,name:x.name,country:x.country,city:x.city,sector:x.sector,probability:prob,expectedValue:expected,currency:x.proposal_currency||"",priority,reason});
  }
  if(out.length){
   await p.query(`UPDATE prospects AS p SET opportunity_probability=f.probability,opportunity_value=f."expectedValue",opportunity_priority=f.priority,opportunity_forecast_reason=f.reason,opportunity_forecast_at=NOW()
    FROM jsonb_to_recordset($1::jsonb) AS f(id uuid,probability integer,"expectedValue" numeric,priority integer,reason text) WHERE p.id=f.id`,[JSON.stringify(out)]);
   await recordDecisionAuditBatch(audits);
  }
  return out.sort((a,b)=>b.priority-a.priority);
 })||[];
}
export async function listOpportunityForecasts(limit=100){
 return await db(async p=>(await p.query(`SELECT id,name,country,city,sector,proposal_currency AS currency,opportunity_probability AS probability,opportunity_value AS "expectedValue",opportunity_priority AS priority,opportunity_forecast_reason AS reason,opportunity_forecast_at AS "forecastAt" FROM prospects WHERE opportunity_forecast_at IS NOT NULL ORDER BY opportunity_priority DESC,opportunity_probability DESC LIMIT $1`,[Math.max(1,Math.min(Number(limit)||100,300))])).rows)||[];
}

export async function listPendingAutomationProspects(limit=16){
 return await db(async p=>(await p.query(`SELECT id,name,domain,sector,city,country,source,status,score,reason,qualification_score AS "qualificationScore",qualification_level AS "qualificationLevel" FROM prospects WHERE (status IN ('new','analysis-queued') AND qualification_level<>'low') OR (status='analyzed' AND (contact_status='' OR (contact_status='verified' AND communication_status NOT IN ('ready-for-review','sent')))) ORDER BY (sector ~* $2 OR source LIKE 'specialist-evidence: %') DESC,COALESCE(qualification_score,0) DESC,created_at ASC LIMIT $1`,[Math.max(1,Math.min(Number(limit)||16,50)),NICHE_PATTERN])).rows)||[];
}

export async function getLatestProspectAnalysis(prospectId){
 return await db(async p=>(await p.query(`SELECT score,summary,findings,recommendations,provider FROM visibility_scans WHERE prospect_id=$1 AND status='completed' ORDER BY completed_at DESC LIMIT 1`,[prospectId])).rows[0])||null;
}
