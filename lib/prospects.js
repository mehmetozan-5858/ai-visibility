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
  const url=normalizeDatabaseUrl(getDatabaseUrl()); if(!url) return null;
  const {Pool}=await import("pg");
  const p=new Pool({connectionString:url});
  try{
    await p.query(`CREATE TABLE IF NOT EXISTS prospects(
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
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Türkiye'");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS qualification_score INTEGER");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS qualification_level TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS qualification_reason TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_url TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_source_url TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_status TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_reason TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_draft TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_status TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS proposal_package TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS proposal_currency TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS proposal_amount INTEGER");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS proposal_reason TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS proposal_status TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS communication_status TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS communication_prepared_at TIMESTAMPTZ");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reply_status TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS communication_sent_at TIMESTAMPTZ");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS communication_provider_id TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS crm_stage TEXT NOT NULL DEFAULT 'new'");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS follow_up_count INTEGER NOT NULL DEFAULT 0");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMPTZ");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reply_classification TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reply_summary TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reply_draft TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reply_needs_human BOOLEAN NOT NULL DEFAULT FALSE");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reply_received_at TIMESTAMPTZ");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS client_id UUID");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_link_status TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS payment_link_created_at TIMESTAMPTZ");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_best_action TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_best_action_reason TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_best_action_priority INTEGER NOT NULL DEFAULT 0");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_best_action_at TIMESTAMPTZ");
    await p.query(`CREATE TABLE IF NOT EXISTS visibility_scans(
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
    return await fn(p)
  }finally{await p.end()}
}

export async function listProspects(){
  return await db(async p=>(await p.query(`SELECT p.id,p.name,p.domain,p.sector,p.city,p.country,p.source,p.status,p.score,p.reason,p.created_at AS "createdAt",
    (SELECT vs.status FROM visibility_scans vs WHERE vs.prospect_id=p.id ORDER BY vs.created_at DESC LIMIT 1) AS "scanStatus"
    FROM prospects p ORDER BY p.created_at DESC`)).rows)||[]
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
    if(STRONG_FIT.some(s=>sector.includes(s))){score+=20;reasons.push("çözüm satılabilirliği güçlü sektör")}
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
  return await db(async p=>(await p.query(
    `UPDATE prospects SET contact_email=$2,contact_url=$3,contact_source_url=$4,contact_status=$5 WHERE id=$1 RETURNING id,name,contact_email AS "contactEmail",contact_url AS "contactUrl",contact_source_url AS "contactSourceUrl",contact_status AS "contactStatus"`,
    [prospectId,contact.email||"",contact.contactUrl||"",contact.sourceUrl||"",contact.status||"not-found"]
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
    ORDER BY qualification_score DESC NULLS LAST, created_at DESC LIMIT $1`,[Math.max(1,Math.min(Number(limit)||100,200))])).rows)||[]
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
      communication_status AS "communicationStatus",follow_up_at AS "followUpAt",reply_status AS "replyStatus",
      outreach_draft AS "outreachDraft",proposal_package AS "proposalPackage",proposal_currency AS "proposalCurrency",proposal_amount AS "proposalAmount"
    FROM prospects
    WHERE communication_status IN ('sent','follow-up-due') AND COALESCE(reply_status,'')=''
      AND (follow_up_at IS NULL OR follow_up_at<=NOW())
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


export async function markProspectFollowUpSent(prospectId){
  return await db(async p=>(await p.query(`
    UPDATE prospects SET communication_status='sent',crm_stage='contacted',
      follow_up_count=follow_up_count+1,last_follow_up_at=NOW(),
      follow_up_at=CASE WHEN follow_up_count+1<2 THEN NOW()+INTERVAL '5 days' ELSE NULL END
    WHERE id=$1 AND COALESCE(reply_status,'')='' AND follow_up_count<2
    RETURNING id,name,follow_up_count AS "followUpCount",follow_up_at AS "followUpAt",crm_stage AS "crmStage"`,[prospectId])).rows[0])||null
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
   out.push({id:x.id,name:x.name,action,reason,priority});
  }return out.sort((a,b)=>b.priority-a.priority);
 })||[];
}
export async function listNextBestActions(limit=100){
 return await db(async p=>(await p.query(`SELECT id,name,country,city,sector,crm_stage AS "crmStage",next_best_action AS "action",next_best_action_reason AS "reason",next_best_action_priority AS "priority",next_best_action_at AS "evaluatedAt" FROM prospects WHERE COALESCE(next_best_action,'')<>'' ORDER BY next_best_action_priority DESC,next_best_action_at DESC LIMIT $1`,[Math.max(1,Math.min(Number(limit)||100,300))])).rows)||[];
}
