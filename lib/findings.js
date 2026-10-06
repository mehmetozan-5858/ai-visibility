import crypto from "node:crypto";
import {getDatabaseUrl} from "./db";

function normalizeDatabaseUrl(rawUrl){
  if(!rawUrl)return "";
  try{const url=new URL(rawUrl);const sslmode=url.searchParams.get("sslmode");if(["prefer","require","verify-ca"].includes(sslmode))url.searchParams.set("sslmode","verify-full");return url.toString()}catch{return rawUrl}
}
async function withDb(fn){
  const url=normalizeDatabaseUrl(getDatabaseUrl());if(!url)throw new Error("database-not-configured");
  const {Pool}=await import("pg");const pool=new Pool({connectionString:url});
  try{await ensure(pool);return await fn(pool)}finally{await pool.end()}
}
async function ensure(pool){
  await pool.query(`CREATE TABLE IF NOT EXISTS findings(
    id UUID PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
    fingerprint TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'medium',
    category TEXT NOT NULL DEFAULT 'visibility',
    status TEXT NOT NULL DEFAULT 'open',
    priority BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(client_id,scan_id,fingerprint)
  )`);
  await pool.query(`ALTER TABLE findings ADD COLUMN IF NOT EXISTS priority BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`CREATE TABLE IF NOT EXISTS solution_offers(
    id UUID PRIMARY KEY,
    finding_id UUID NOT NULL UNIQUE REFERENCES findings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    deliverable TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'TRY',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}
function clean(v){return String(v||"").trim()}
function severityFor(text,score){
  const t=clean(text).toLocaleLowerCase("tr-TR");
  if(score<40||/(yok|eksik|hatalı|bulunam|kritik|doğrulanmamış)/.test(t))return "critical";
  if(score<60||/(tutarsız|zayıf|iyileştir|artırılmalı|geliştir)/.test(t))return "high";
  if(score<75)return "medium";
  return "low";
}
function solutionFor(text){
  const t=clean(text).toLocaleLowerCase("tr-TR");
  if(/schema|yapılandırılmış/.test(t))return ["Schema / JSON-LD uygulaması","Uygun schema tiplerini hazırlama, doğrulama ve yayına alma paketi."];
  if(/faq|sss|sık sor/.test(t))return ["SSS + FAQ Schema paketi","AI uyumlu SSS içeriği ve FAQ yapılandırılmış verisi."];
  if(/nap|adres|telefon|yerel|google işlet/.test(t))return ["Yerel işletme veri düzeltmesi","İsim-adres-telefon ve temel yerel işletme sinyallerinin tutarlı hale getirilmesi."];
  if(/içerik|hizmet açıkl|sayfa/.test(t))return ["AI uyumlu içerik iyileştirmesi","Hizmet/sayfa içeriğinin AI motorlarının anlayacağı ve kaynaklayacağı biçimde düzenlenmesi."];
  if(/kaynak|referans|otorite/.test(t))return ["Kaynak ve otorite güçlendirme","Markayı destekleyen güvenilir kaynak, referans ve varlık sinyallerinin güçlendirilmesi."];
  return ["AI görünürlük iyileştirmesi","Bulgunun teknik ve içerik yönünden giderilmesi, ardından yeniden ölçüm."];
}
export async function syncFindingsFromScan(clientId,scan){
  if(!scan?.id)return [];
  return await withDb(async pool=>{
    const created=[];
    for(const result of Array.isArray(scan.results)?scan.results:[]){
      const provider=clean(result?.provider||"AI");const score=Number(result?.score)||0;
      const texts=[...(Array.isArray(result?.findings)?result.findings:[]),...(Array.isArray(result?.recommendations)?result.recommendations:[])].map(clean).filter(Boolean);
      for(const text of texts){
        const fingerprint=crypto.createHash("sha1").update(provider+"|"+text.toLocaleLowerCase("tr-TR")).digest("hex");
        const severity=severityFor(text,score);const [solutionTitle,deliverable]=solutionFor(text);
        const row=(await pool.query(`INSERT INTO findings(id,client_id,scan_id,fingerprint,title,detail,provider,severity,category)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT(client_id,scan_id,fingerprint) DO UPDATE SET updated_at=NOW()
          RETURNING id,client_id AS "clientId",scan_id AS "scanId",title,detail,provider,severity,category,status,priority,created_at AS "createdAt"`,
          [crypto.randomUUID(),clientId,scan.id,fingerprint,text,"Tarama skoru: "+score+"/100",provider,severity,"visibility"])).rows[0];
        if(row){
          await pool.query(`INSERT INTO solution_offers(id,finding_id,title,deliverable) VALUES($1,$2,$3,$4)
            ON CONFLICT(finding_id) DO NOTHING`,[crypto.randomUUID(),row.id,solutionTitle,deliverable]);
          created.push(row);
        }
      }
    }
    return created;
  });
}
export async function listFindings(limit=200){
  const safe=Math.max(1,Math.min(Number(limit)||200,500));
  return await withDb(async pool=>(await pool.query(`SELECT f.id,f.client_id AS "clientId",c.name AS "clientName",f.scan_id AS "scanId",f.title,f.detail,f.provider,f.severity,f.category,f.status,f.priority,
    o.id AS "offerId",o.title AS "solutionTitle",o.deliverable,o.price,o.currency,o.status AS "offerStatus",f.created_at AS "createdAt"
    FROM findings f JOIN clients c ON c.id=f.client_id LEFT JOIN solution_offers o ON o.finding_id=f.id
    ORDER BY f.priority DESC,CASE f.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,f.created_at DESC LIMIT $1`,[safe])).rows)||[];
}
export async function listFindingsForClient(clientId,limit=100){
  const safe=Math.max(1,Math.min(Number(limit)||100,200));
  return await withDb(async pool=>(await pool.query(`SELECT f.id,f.scan_id AS "scanId",f.title,f.detail,f.provider,f.severity,f.category,f.status,f.priority,
    o.id AS "offerId",o.title AS "solutionTitle",o.deliverable,o.price,o.currency,o.status AS "offerStatus",f.created_at AS "createdAt"
    FROM findings f LEFT JOIN solution_offers o ON o.finding_id=f.id
    WHERE f.client_id=$1
    ORDER BY f.priority DESC,CASE f.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,f.created_at DESC LIMIT $2`,[clientId,safe])).rows)||[];
}
export async function requestSolution(clientId,findingId){
 return await withDb(async pool=>{
  const tx=await pool.connect();
  try{
   await tx.query('BEGIN');
   const finding=(await tx.query('SELECT id,status FROM findings WHERE id=$1 AND client_id=$2 FOR UPDATE',[findingId,clientId])).rows[0];
   if(!finding){await tx.query('COMMIT');return null}
   const offer=(await tx.query('SELECT id,status FROM solution_offers WHERE finding_id=$1 FOR UPDATE',[findingId])).rows[0];
   // Repeated requests must not rewind accepted, paid or completed work.
   const eligibleFinding=['open','requested','offered'].includes(finding.status);
   const eligibleOffer=!offer||['draft','requested','offered'].includes(offer.status);
   if(!eligibleFinding||!eligibleOffer){await tx.query('COMMIT');return {findingId,requested:false,unchanged:true}}
   if(finding.status!=='requested')await tx.query("UPDATE findings SET status='requested',updated_at=NOW() WHERE id=$1",[findingId]);
   if(offer&&offer.status!=='requested')await tx.query("UPDATE solution_offers SET status='requested',updated_at=NOW() WHERE id=$1",[offer.id]);
   await tx.query('COMMIT');return {findingId,requested:true};
  }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e}finally{tx.release()}
 });
}
export async function updateFindingOffer(input){
  const allowedFinding=new Set(["open","requested","offered","approved","in-progress","resolved","dismissed"]);
  const allowedOffer=new Set(["draft","requested","offered","accepted","paid","in-progress","completed","cancelled"]);
  return await withDb(async pool=>{
    if(input.findingId&&allowedFinding.has(input.status))await pool.query('UPDATE findings SET status=$2,updated_at=NOW() WHERE id=$1',[input.findingId,input.status]);
    if(input.findingId&&typeof input.priority==="boolean")await pool.query('UPDATE findings SET priority=$2,updated_at=NOW() WHERE id=$1',[input.findingId,input.priority]);
    if(input.offerId){
      const price=Math.max(0,Math.round(Number(input.price)||0));
      const offerStatus=allowedOffer.has(input.offerStatus)?input.offerStatus:null;
      await pool.query(`UPDATE solution_offers SET price=CASE WHEN $2::int>=0 THEN $2 ELSE price END,status=COALESCE($3,status),updated_at=NOW() WHERE id=$1`,[input.offerId,price,offerStatus]);
    }
    return true;
  });
}
