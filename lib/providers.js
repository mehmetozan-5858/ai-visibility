import {contactPageUrl} from './contact-page-verification';
import {inspectProspectWebsite} from "./website-inspection";
import {permissionEnquiry} from "./outreach-quality";
import {NICHE_SECTORS} from "./niche-targeting";
import {AsyncLocalStorage} from "node:async_hooks";
import {budgetFetch as timedFetch,remainingBudget} from "./request-budget";
import {recordProviderHealth,chooseHealthyProvider,recordDecisionAudit,recordOperationalCost} from "./agent-coordination";

const costContext=new AsyncLocalStorage();
async function recordProviderCall(name,operation,started,usage=null){
 const configuredCost=Number(process.env[`AI_COST_${name.toUpperCase()}_USD`]);
 const known=Number.isFinite(configuredCost)&&configuredCost>0,engine=String(operation).startsWith("creator-")?"creator":operation==="provider-http"?"unknown":"business";
 await recordOperationalCost({costType:"ai-provider",provider:name,operation,marketKey:`${engine}:ai`,amount:known?configuredCost:0,currency:"USD",estimated:true,metadata:{engine,pricingSource:known?"env-estimate":"unconfigured-zero",usage,latencyMs:Date.now()-started}}).catch(()=>null);
}
async function fetch(url,options={}){
 const started=Date.now(),response=await timedFetch(url,options);
 if(response.ok){const name=String(url).includes("googleapis.com")?"Gemini":String(url).includes("perplexity.ai")?"Perplexity":"ChatGPT";let usage=null;
  try{const data=await response.clone().json();usage=data.usageMetadata||data.usage||null}catch{}
  await recordProviderCall(name,costContext.getStore()||"provider-http",started,usage);
 }
 return response;
}

export const PROVIDERS=["ChatGPT","Gemini","Perplexity"];

function configured(name){
  if(name==="ChatGPT") return Boolean(
    process.env.OPENAI_API_KEY||
    process.env.AI_PROVIDER_API_KEY||
    process.env.AI_GATEWAY_API_KEY||
    process.env.VERCEL_OIDC_TOKEN||
    process.env.VERCEL
  );
  if(name==="Gemini") return Boolean(process.env.GEMINI_API_KEY);
  if(name==="Perplexity") return Boolean(process.env.PERPLEXITY_API_KEY);
  return false;
}

export function providerStatus(){
  return PROVIDERS.map(name=>({name,status:configured(name)?"connected":"not-connected"}));
}

function parseJson(text){
  const clean=(text||"").replace(/^```json\s*/i,"").replace(/```$/,"").trim();
  try{return JSON.parse(clean)}catch{}
  const a=clean.indexOf("{"),b=clean.lastIndexOf("}");
  if(a>=0&&b>a){try{return JSON.parse(clean.slice(a,b+1))}catch{}}
  throw new Error("provider-json-invalid");
}

function promptFor(p){
  return `You are an AI visibility/GEO-AEO analyst. Analyze this business as a prospect for an AI visibility service.
Business: ${p.name}
Website: ${p.domain||"unknown"}
Sector: ${p.sector||"unknown"}
City: ${p.city||"unknown"}
Server-controlled website inspection (limited to downloaded HTML): ${JSON.stringify(p.websiteInspection||{status:"unavailable"})}

Return ONLY valid JSON with this exact shape:
{"score":0,"summary":"","findings":[""],"recommendations":[""],"reason":""}

Rules:
- score is only a provisional model estimate, NOT a measured AI-search visibility score or proof of a business problem.
- Findings are unverified review questions, not verified defects. Clearly state unknowns and what must be checked.
- Do not infer missing Google Business Profile, inconsistent NAP, missing schema, rankings or traffic from the absence of data.
- Any website inspection only describes its specific downloaded HTML page. It does not establish AI-search visibility.
- Do not invent rankings, reviews, traffic, citations, or competitor facts.
- findings: 2-5 concrete observations framed as things to verify or improve.
- recommendations: 2-5 practical GEO/AEO actions.
- reason: one short sales-relevance sentence.
- Turkish language for all text fields.`;
}

async function runOpenAI(p){
  const directKey=process.env.OPENAI_API_KEY||process.env.AI_PROVIDER_API_KEY;
  if(directKey){
    const r=await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{"content-type":"application/json","authorization":`Bearer ${directKey}`},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||"gpt-4.1-mini",
        temperature:0.2,
        response_format:{type:"json_object"},
        messages:[{role:"user",content:promptFor(p)}]
      })
    });
    if(!r.ok) throw new Error(`openai-${r.status}`);
    const d=await r.json();
    return {provider:"ChatGPT",...parseJson(d?.choices?.[0]?.message?.content||"")};
  }

  if(process.env.VERCEL||process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN){
    const {generateText}=await import("ai");
    const started=Date.now();
    const {text,usage}=await generateText({
      model:process.env.OPENAI_GATEWAY_MODEL||"openai/gpt-5-nano",
      abortSignal:AbortSignal.timeout(Math.max(1,Math.min(15000,remainingBudget()))),
      prompt:promptFor(p)
    });
    await recordProviderCall("ChatGPT","visibility-scan",started,usage);
    return {provider:"ChatGPT",...parseJson(text||"")};
  }

  return null;
}

async function runGemini(p){
  const key=process.env.GEMINI_API_KEY;
  if(!key) return null;
  const model=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:promptFor(p)}]}],generationConfig:{temperature:0.2,responseMimeType:"application/json"}})});
  if(!r.ok) throw new Error(`gemini-${r.status}`);
  const d=await r.json();
  return {provider:"Gemini",...parseJson(d?.candidates?.[0]?.content?.parts?.[0]?.text||"")};
}

async function runPerplexity(p){
  const key=process.env.PERPLEXITY_API_KEY;
  if(!key) return null;
  const r=await fetch("https://api.perplexity.ai/v1/agent",{
    method:"POST",
    headers:{"content-type":"application/json","authorization":`Bearer ${key}`},
    body:JSON.stringify({
      preset:process.env.PERPLEXITY_PRESET||"fast",
      input:promptFor(p)
    })
  });
  if(!r.ok){
    const detail=(await r.text()).slice(0,220);
    throw new Error(`perplexity-${r.status}: ${detail}`);
  }
  const d=await r.json();
  const message=(d?.output||[]).find(x=>x?.type==="message");
  const text=(message?.content||[]).find(x=>x?.type==="output_text")?.text||"";
  return {provider:"Perplexity",...parseJson(text)};
}

function normalizeProviderResult(result){
  if(!result)return null;
  const score=Math.max(0,Math.min(100,Number(result.score)||0));
  return {...result,score,findings:Array.isArray(result.findings)?result.findings:[],recommendations:Array.isArray(result.recommendations)?result.recommendations:[]};
}

async function observedRun(name,runner,prospect){
  const started=Date.now();
  try{const result=normalizeProviderResult(await costContext.run("visibility-scan",()=>runner(prospect)));if(result)result.evidence=prospect.websiteInspection;await recordProviderHealth({provider:name,ok:Boolean(result),latencyMs:Date.now()-started,error:result?"":"no-result"}).catch(()=>null);return result}
  catch(e){await recordProviderHealth({provider:name,ok:false,latencyMs:Date.now()-started,error:String(e?.message||e)}).catch(()=>null);throw e}
}
export async function runProviderChecks(prospect){
  prospect={...prospect,websiteInspection:await inspectProspectWebsite(prospect)};
  const entries=[["ChatGPT",runOpenAI],["Gemini",runGemini],["Perplexity",runPerplexity]].filter(([name])=>configured(name));
  const settled=await Promise.allSettled(entries.map(async([name,runner])=>({name,result:await observedRun(name,runner,prospect)})));
  const results=[],errors=[];settled.forEach((item,i)=>{const name=entries[i]?.[0]||"Provider";if(item.status==="fulfilled"&&item.value?.result)results.push(item.value.result);else errors.push({provider:name,error:item.status==="rejected"?String(item.reason?.message||item.reason):"no-result"})});
  return {results,errors};
}
export async function runProviderCheck(prospect,{inspection}={}){
  let reusable=false;
  try{const age=Date.now()-Date.parse(inspection?.checkedAt);reusable=inspection?.method==='official-html-v1'&&inspection?.status==='checked'&&age>=0&&age<86400000&&!!contactPageUrl(inspection.sourceUrl,prospect.domain)}catch{}
  prospect={...prospect,websiteInspection:reusable?inspection:await inspectProspectWebsite(prospect)};
  const available=[["ChatGPT",runOpenAI],["Gemini",runGemini],["Perplexity",runPerplexity]].filter(([name])=>configured(name));
  const remaining=[...available],errors=[];
  while(remaining.length){
    const preferred=await chooseHealthyProvider(remaining.map(x=>x[0])).catch(()=>remaining[0][0]);
    const idx=Math.max(0,remaining.findIndex(x=>x[0]===preferred)),[name,runner]=remaining.splice(idx,1)[0];
    try{const result=await observedRun(name,runner,prospect);if(result)return result}catch(e){errors.push({provider:name,error:String(e?.message||e)})}
  }
  return null;
}


async function resilientJson(prompt,options={}){
 return costContext.run(options.operation||"generic",()=>resilientJsonCall(prompt,options));
}
async function resilientJsonCall(prompt,{temperature=0.2,preferred=["Gemini","ChatGPT","Perplexity"],operation="generic"}={}){
  const available=preferred.filter(configured),remaining=[...available],errors=[];
  while(remaining.length){
    const name=await chooseHealthyProvider(remaining).catch(()=>remaining[0]);remaining.splice(remaining.indexOf(name),1);const started=Date.now();
    await recordDecisionAudit({decisionType:"provider-selection",entityType:"ai-operation",entityId:operation,agent:"Reliability Brain",input:{candidates:[name,...remaining]},decision:{provider:name},rationale:"Provider selected from current health and latency memory; fallback candidates retained."}).catch(()=>null);
    try{
      let text="";
      if(name==="Gemini"){const key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature,responseMimeType:"application/json"}})});if(!r.ok)throw new Error(`gemini-${operation}-${r.status}`);const d=await r.json();text=d?.candidates?.[0]?.content?.parts?.[0]?.text||""}
      else if(name==="ChatGPT"){const key=process.env.OPENAI_API_KEY||process.env.AI_PROVIDER_API_KEY;if(!key)throw new Error("openai-direct-key-missing");const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${key}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",temperature,response_format:{type:"json_object"},messages:[{role:"user",content:prompt}]})});if(!r.ok)throw new Error(`openai-${operation}-${r.status}`);const d=await r.json();text=d?.choices?.[0]?.message?.content||""}
      else {const key=process.env.PERPLEXITY_API_KEY;const r=await fetch("https://api.perplexity.ai/v1/agent",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${key}`},body:JSON.stringify({preset:process.env.PERPLEXITY_PRESET||"fast",input:prompt})});if(!r.ok)throw new Error(`perplexity-${operation}-${r.status}`);const d=await r.json(),m=(d?.output||[]).find(x=>x?.type==="message");text=(m?.content||[]).find(x=>x?.type==="output_text")?.text||""}
      const parsed=parseJson(text);const usage=name==="Gemini"?null:name==="ChatGPT"?null:null;
      await recordProviderHealth({provider:name,ok:true,latencyMs:Date.now()-started}).catch(()=>null);
      return {provider:name,data:parsed};
    }catch(e){errors.push({provider:name,error:String(e?.message||e)});await recordProviderHealth({provider:name,ok:false,latencyMs:Date.now()-started,error:String(e?.message||e)}).catch(()=>null);await recordDecisionAudit({decisionType:"provider-failover",entityType:"ai-operation",entityId:operation,agent:"Reliability Brain",input:{failedProvider:name},decision:{fallbackRemaining:[...remaining]},rationale:"Provider call failed; operation will try the next eligible provider.",outcome:{error:String(e?.message||e).slice(0,180)}}).catch(()=>null)}
  }throw new Error(`resilient-ai-failed:${operation}:${errors.map(x=>x.provider).join(",")}`);
}

export async function runContentPlan(input){
  const key=process.env.GEMINI_API_KEY;
  if(!key) throw new Error("gemini-key-missing");
  const model=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
  const prompt=`You are a GEO/AEO content strategist. Create a concise Turkish content improvement plan from this completed visibility scan.

Business: ${input.clientName||""}
Score: ${input.score??""}/100
Summary: ${input.summary||""}
Findings: ${JSON.stringify(input.findings||[])}
Recommendations: ${JSON.stringify(input.recommendations||[])}

Return ONLY valid JSON:
{"headline":"","priorities":[""],"contentIdeas":[{"title":"","format":"","goal":""}],"quickWins":[""]}

Rules:
- Turkish only.
- 3 priorities.
- 4 content ideas.
- 3 quick wins.
- Do not invent rankings, reviews, traffic or competitor facts.`;

  return (await resilientJson(prompt,{temperature:0.2,operation:"content-plan"})).data;
}


export async function discoverBusinesses({country="Türkiye",city="Sivas",sector="",nicheFocus=false,focusArea="",existingNames=[]}={}){
  const key=process.env.PERPLEXITY_API_KEY;
  if(!key) throw new Error("perplexity-key-missing");

  const targetSectors=[
    ...NICHE_SECTORS,
    "Restoran / Kafe",
    "Özel Sağlık / Klinik",
    "Diş Kliniği",
    "Güzellik / Bakım",
    "Emlak",
    "Otomotiv",
    "Eğitim / Kurs",
    "Mobilya / Ev Dekorasyon",
    "Spor / Fitness",
    "Hukuk / Muhasebe",
    "Turizm / Otel",
    "Ev Hizmetleri",
    "Tekstil / Giyim",
    "Tekstil / Konfeksiyon Üretimi",
    "Makine / Endüstriyel Ekipman Üretimi",
    "Metal / Çelik / Döküm Üretimi",
    "Plastik / Kauçuk Üretimi",
    "Ambalaj / Matbaa Üretimi",
    "Mobilya Üretimi",
    "Gıda / İçecek Üretimi",
    "Otomotiv Yan Sanayi",
    "Kimya / Temizlik Ürünleri Üretimi",
    "Yapı Malzemeleri Üretimi",
    "Medikal / Sağlık Ürünleri Üretimi",
    "Elektronik / Elektrik Ekipmanı Üretimi","Tekstil / Konfeksiyon Üretimi","Makine / Endüstriyel Ekipman Üretimi","Metal / Çelik / Döküm Üretimi","Plastik / Kauçuk Üretimi","Ambalaj / Kağıt Üretimi","Mobilya Üretimi","Gıda / İçecek Üretimi","Otomotiv Yan Sanayi","Kimya / Kozmetik Üretimi","Yapı Malzemeleri Üretimi","Medikal / Sağlık Ürünleri Üretimi","Elektronik / Elektrik Ekipmanı Üretimi",
    "Tekstil / Konfeksiyon Üretimi",
    "Makine / Endüstriyel Ekipman Üretimi",
    "Metal / Çelik / Döküm Üretimi",
    "Plastik / Kauçuk Üretimi",
    "Ambalaj / Paketleme Üretimi",
    "Mobilya Üretimi",
    "Gıda / İçecek Üretimi",
    "Otomotiv Yan Sanayi",
    "Kimya / Kozmetik Üretimi",
    "Yapı Malzemeleri Üretimi",
    "Medikal / Sağlık Ürünleri Üretimi",
    "Elektronik / Elektrik Üretimi"
  ];

  const selectedSector=targetSectors.includes(sector)?sector:"";
  const sectorRules=selectedSector
    ? `- Return up to 12 verified businesses from this sector only: ${selectedSector}.
- Prefer independent specialist B2B firms with specific technical products or services and an official site; fewer verified matches are better than filler.
- Do not mix in other sectors.`
    : nicheFocus ? `- Return up to 12 verified specialist businesses, across ANY sector.
- The theme ${focusArea||"specialist B2B"} is an exploration starting point, NOT an exclusive sector filter. CNC, packaging, laboratories and consulting are examples, not an exhaustive list.
- Choose firms serving a precise customer problem with specific technical products/services, a clearly defined buyer, an official site and a plausible serviceable discoverability opportunity.
- Prefer independent/regional firms whose official pages establish their speciality. Avoid generic directory entries, broad undifferentiated businesses and national chains.
- Find stronger evidence rather than filling a quota. Do not assume a missing AI ranking.
- Every result must describe its speciality and buyer in specialistEvidence and provide the official page in sourceUrl.
- Do not return generic hotels, restaurants or cafes merely because they are easy to find. A genuinely specialist company in any field is eligible.`
    : `- Return up to 12 verified businesses.
- Prioritize manufacturers, factories, industrial suppliers, B2B producers and export-capable companies; at least 7 of the 12 results should be production/manufacturing/B2B when verifiable.
- Use diverse sectors from this list:
${targetSectors.map((s,i)=>`${i+1}. ${s}`).join("\n")}
- Maximum 2 businesses from the same sector.
- Maximum 1 hotel/tourism or restaurant business total.
- At least 9 results should be niche technical manufacturers or specialist B2B services from: ${NICHE_SECTORS.join("; ")}, when verifiable. Never pad the list.`;

  const prompt=`You are a local business research agent with web access.

Find REAL, CURRENT businesses in ${city}, ${country} for AI visibility/GEO-AEO sales outreach.

SECTOR RULES:
${sectorRules}

VERIFICATION RULES:
- Commercial priority: manufacturers/factories, B2B suppliers, exporters or export-capable producers with products that benefit from stronger global discoverability.
- Prefer companies with an official product catalogue, production capability, dealer/distributor/export activity or clear B2B sales potential when public evidence supports it.
- For testing, calibration, certification and technical consulting, verify the specific services on the official site. Never invent accreditation or export activity.
- Sector fit is NOT proof of an AI visibility problem. Do not claim missing rankings, leads or revenue without measurement.
- Prefer locally owned or regional businesses over national chains when possible.
- Do NOT return any of these existing businesses: ${JSON.stringify(existingNames||[])}
- Every business must be real and currently operating.
- Each item must have an official website/domain or a clearly identifiable official web presence.
- Do not invent businesses, domains, rankings, reviews, traffic, or contacts.
- If a candidate cannot be verified, omit it and find another.

Return ONLY valid JSON:
{"businesses":[{"name":"","domain":"","sector":"${selectedSector||"one listed sector"}","city":"${city}","country":"${country}","source":"perplexity-web","specialistEvidence":"specific product/service and target buyer, based on official page","sourceUrl":"official HTTPS page"}]}

Keep domain as hostname only, without protocol or path.`;

  const r=await fetch("https://api.perplexity.ai/v1/agent",{
    method:"POST",
    headers:{"content-type":"application/json","authorization":`Bearer ${key}`},
    body:JSON.stringify({preset:process.env.PERPLEXITY_PRESET||"fast",input:prompt})
  });
  if(!r.ok){
    const detail=(await r.text()).slice(0,300);
    throw new Error(`perplexity-discovery-${r.status}: ${detail}`);
  }

  const d=await r.json();
  const message=(d?.output||[]).find(x=>x?.type==="message");
  const text=(message?.content||[]).find(x=>x?.type==="output_text")?.text||"";
  const parsed=parseJson(text);
  const raw=Array.isArray(parsed?.businesses)?parsed.businesses:[];

  const seenNames=new Set((existingNames||[]).map(x=>String(x).toLocaleLowerCase("tr-TR")));
  const sectorCounts=new Map();
  const out=[];

  for(const x of raw){
    if(!x?.name||!x?.sector||!x?.city)continue;
    const name=String(x.name).trim();
    const keyName=name.toLocaleLowerCase("tr-TR");
    if(seenNames.has(keyName))continue;

    const itemSector=selectedSector||String(x.sector).trim();
    if(selectedSector&&String(x.sector).trim().toLocaleLowerCase("tr-TR")!==selectedSector.toLocaleLowerCase("tr-TR"))continue;
    const sk=itemSector.toLocaleLowerCase("tr-TR");
    const count=sectorCounts.get(sk)||0;
    if(!selectedSector&&count>=2)continue;

    const domain=String(x.domain||"").trim().replace(/^https?:\/\//,"").replace(/\/.*$/,"");
    let specialistSource="";
    if(nicheFocus&&!selectedSector){
      try{const u=new URL(x.sourceUrl),h=u.hostname.toLowerCase().replace(/^www\./,"");const official=domain.toLowerCase().replace(/^www\./,"");
        if(u.protocol!=="https:"||u.username||u.password||!(h===official||h.endsWith("."+official))||String(x.specialistEvidence||"").trim().length<30)continue;
        specialistSource="specialist-evidence: "+String(x.specialistEvidence).trim().slice(0,500)+" | "+u.href;
      }catch{continue}
    }
    out.push({name,domain,sector:itemSector,city:String(x.city||city).trim(),country:String(x.country||country).trim(),source:specialistSource||"perplexity-web"});
    seenNames.add(keyName);
    sectorCounts.set(sk,count+1);
    if(out.length>=12)break;
  }

  return out;
}

export async function runSalesOffer(input){
  const key=process.env.GEMINI_API_KEY;
  if(!key) throw new Error("gemini-key-missing");
  const model=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
  const prompt=`You are a Turkish B2B sales strategist for an AI visibility/GEO-AEO service.

Business: ${input.clientName||""}
Website: ${input.domain||""}
Overall AI visibility score: ${input.score??""}/100
Provider results: ${JSON.stringify(input.results||[])}

Create a concise sales opportunity brief in Turkish.
Return ONLY JSON:
{"priority":"yüksek|orta|düşük","whyNow":[""],"offer":{"name":"","setupPriceRange":"","monthlyPriceRange":"","scope":[""]},"outreachDraft":""}

Rules:
- Base the priority only on the supplied scan evidence and commercial relevance.
- Do not invent revenue, traffic, rankings, reviews or contacts.
- Outreach draft must be respectful, short, non-spammy, and ask permission to share a free summary.
- No automatic-send language.`;

  return (await resilientJson(prompt,{temperature:0.2,operation:"sales-offer"})).data;
}


export async function runImplementationPlan(input){
  const key=process.env.GEMINI_API_KEY;
  if(!key) throw new Error("gemini-key-missing");
  const model=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
  const prompt=`You are a GEO/AEO implementation specialist. Turn this completed AI visibility audit into an implementation-ready Turkish work package.

Business: ${input.clientName||""}
Website: ${input.domain||""}
Overall score: ${input.score??""}/100
Provider results: ${JSON.stringify(input.results||[])}

Return ONLY valid JSON:
{
  "headline":"",
  "readyNow":[
    {"title":"","type":"FAQ|META|SCHEMA|CONTENT|LOCATION_PAGE","deliverable":""}
  ],
  "accessRequired":[
    {"title":"","system":"Website|Google Business Profile|Other","action":""}
  ],
  "approvalRequired":[
    {"field":"","reason":""}
  ],
  "faq":[{"q":"","a":""}],
  "meta":{"title":"","description":""},
  "schema":{"type":"","jsonLd":{}},
  "locationPage":{"title":"","outline":[""]},
  "nextSteps":[""]
}

Rules:
- Turkish only except schema property names.
- Never invent address, phone, opening hours, prices, menu items, ratings, awards, or credentials.
- If a fact is unknown, use placeholders like "[MÜŞTERİDEN ONAYLI ADRES]".
- Provide 3-5 readyNow items, 1-4 accessRequired items, and only genuinely needed approvalRequired items.
- faq: 3 concise Q&A items using no invented facts.
- meta must be publishable without unsupported claims.
- schema.jsonLd must be valid JSON-LD style data and use placeholders for unknown real-world business facts.
- locationPage outline should be concise.
- nextSteps should clearly separate what AI Visibility can prepare from what requires customer access/approval.`;

  return (await resilientJson(prompt,{temperature:0.15,operation:"implementation-plan"})).data;
}


export async function findPublicBusinessContact(prospect){
  const key=process.env.PERPLEXITY_API_KEY;if(!key)throw new Error("perplexity-key-missing");
  const prompt=`Find a VERIFIED PUBLIC business contact channel for this real business.
Business: ${prospect.name}
Official domain: ${prospect.domain||"unknown"}
City/Country: ${prospect.city||""}, ${prospect.country||""}

Return ONLY JSON:
{"email":"","contactUrl":"","sourceUrl":"","status":"verified|not-found"}

Rules:
- Use only clearly public CORPORATE contact information published by the business or its official website.
- Never infer or guess an email address.
- Do not return private/personal contact details.
- Prefer an official contact page/form; corporate email is allowed only when visibly published.
- sourceUrl must be the public page that proves the contact channel.
- If you cannot verify it, return status not-found and blank fields.`;
  const r=await fetch("https://api.perplexity.ai/v1/agent",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${key}`},body:JSON.stringify({preset:process.env.PERPLEXITY_PRESET||"fast",input:prompt})});
  if(!r.ok)throw new Error(`perplexity-contact-${r.status}`);
  const d=await r.json(),message=(d?.output||[]).find(x=>x?.type==="message"),text=(message?.content||[]).find(x=>x?.type==="output_text")?.text||"";
  const x=parseJson(text);const verified=x?.status==="verified"&&x?.sourceUrl&&(x?.email||x?.contactUrl);
  return {email:verified?String(x.email||""):"",contactUrl:verified?String(x.contactUrl||""):"",sourceUrl:verified?String(x.sourceUrl||""):"",status:verified?"verified":"not-found"};
}


export async function personalizeProspectOutreach(prospect,scanResult,contact={}){
  // A first-contact enquiry must not turn provisional findings into customer claims.
  return {reason:"AI görünürlük değerlendirmesi paylaşmak için izin talebi; ihtiyaç henüz doğrulanmadı.",draft:permissionEnquiry(prospect),status:"drafted"};
}


export async function buildProspectProposal(prospect,scanResult,personalized={}){
  const country=String(prospect.country||"").toLowerCase();
  const pricing=country==="türkiye"||country==="turkey"
    ? {currency:"TRY",diagnosis:4990,solution:19900,monitoring:6990}
    : country==="united kingdom"
      ? {currency:"GBP",diagnosis:99,solution:399,monitoring:139}
      : ["germany","france","netherlands","italy","spain","austria"].includes(country)
        ? {currency:"EUR",diagnosis:119,solution:449,monitoring:159}
        : {currency:"USD",diagnosis:129,solution:499,monitoring:169};
  const packageName="AI Visibility Diagnosis";
  const amount=packageName==="AI Visibility Solution"?pricing.solution:packageName==="AI Visibility Diagnosis"?pricing.diagnosis:pricing.monitoring;
  const reason="Ön değerlendirme taslağı; müşteri ihtiyacı ve uygulama kapsamı doğrulama gerektirir. Tahmini görünürlük skoru ölçüm değildir.";
  return {package:packageName,currency:pricing.currency,amount,reason,status:"drafted"};
}


export async function analyzeSalesReply(input={}){
  const key=process.env.GEMINI_API_KEY;if(!key)throw new Error("gemini-key-missing");
  const model=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
  const prompt=`You are a careful B2B reply and objection agent for AI Visibility Works.
Business: ${input.name||""}
Country: ${input.country||""}
Original offer: ${input.proposalPackage||""} ${input.proposalAmount||""} ${input.proposalCurrency||""}
Customer reply: ${input.replyText||""}

Return ONLY JSON:
{"classification":"interested|price-objection|info-request|meeting-request|not-interested|other","crmStatus":"interested|replied|meeting|lost","summary":"","draftReply":"","needsHuman":false}

Rules:
- Reply in the customer's language when clearly identifiable; otherwise Turkish.
- Never invent discounts, guarantees, results, rankings, traffic, reviews, contacts, capabilities or contract terms.
- If price is challenged, explain value briefly; do not offer a discount without human approval.
- If they request a meeting, acknowledge and ask for suitable date/time; do not invent availability.
- If they say no/unsubscribe/do not contact, classification not-interested, crmStatus lost, draftReply empty.
- Keep draftReply concise and professional.
- Set needsHuman true for legal threats, complaints, unusual commercial terms, refunds, data/privacy requests, or anything uncertain.
- This is a DRAFT. Never claim it was sent.`;
  const x=(await resilientJson(prompt,{temperature:0.15,operation:"reply-analysis"})).data;
  const allowed=new Set(["interested","price-objection","info-request","meeting-request","not-interested","other"]);
  return {classification:allowed.has(x?.classification)?x.classification:"other",crmStatus:String(x?.crmStatus||"replied"),summary:String(x?.summary||"").slice(0,800),draftReply:String(x?.draftReply||"").slice(0,4000),needsHuman:Boolean(x?.needsHuman)};
}


export async function discoverBenchmarkSignals(){
 const key=process.env.PERPLEXITY_API_KEY;if(!key)throw new Error("perplexity-key-missing");
 const prompt=`You are an evidence-first competitive intelligence analyst. Research CURRENT public developments in AI visibility, GEO/AEO, answer-engine optimization, AI search analytics, agentic marketing/sales automation, AI commerce readiness, and autonomous business operations.
Return only material product/capability/market signals that could affect an AI Visibility platform.
Every signal MUST have a directly supporting public source URL and, when visible, source date. Do not infer private metrics, revenue, customers, rankings, or capabilities.
Return ONLY JSON:
{"signals":[{"category":"","competitor":"","signal":"","sourceUrl":"https://...","sourceDate":"","confidence":0,"relevance":0}]}
Rules: max 15 signals; confidence/relevance 0-100; omit anything without a source URL; distinguish vendor claim from independently verified fact in evidenceNote.`;
 const r=await fetch("https://api.perplexity.ai/v1/agent",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${key}`},body:JSON.stringify({preset:process.env.PERPLEXITY_PRESET||"fast",input:prompt})});
 if(!r.ok)throw new Error(`benchmark-research-${r.status}: ${(await r.text()).slice(0,180)}`);
 const d=await r.json(),message=(d?.output||[]).find(x=>x?.type==="message"),txt=(message?.content||[]).find(x=>x?.type==="output_text")?.text||"",parsed=parseJson(txt);
 return (Array.isArray(parsed?.signals)?parsed.signals:[]).filter(x=>x?.sourceUrl&&/^https?:\/\//i.test(x.sourceUrl)).slice(0,15);
}


export async function discoverCreatorBenchmarkSignals(){
 const key=process.env.PERPLEXITY_API_KEY;if(!key)throw new Error("perplexity-key-missing");
 const prompt=`You are an evidence-first creator economy competitive intelligence analyst. Research CURRENT public developments in creator analytics, YouTube/Instagram/TikTok/X/LinkedIn growth tooling, social listening, personal-bra…369 tokens truncated…n(txt);
 return (Array.isArray(parsed?.signals)?parsed.signals:[]).filter(x=>x?.sourceUrl&&/^https?:\/\//i.test(x.sourceUrl)&&String(x.category||"").startsWith("creator:")).slice(0,15);
}


export async function personalizeCreatorOutreach(creator){
 const prompt=`You are an evidence-first Creator & Personal Brand growth analyst.
Creator: ${creator.displayName||""}
Platform/handle: ${creator.platform||""} ${creator.handle||""}
Profile: ${creator.profileUrl||""}
Niche/country: ${creator.niche||""}, ${creator.country||""}
Opportunity score: ${Number(creator.opportunityScore)||0}
Evidence: ${JSON.stringify(creator.evidence||{})}
Public business contact exists: ${Boolean(creator.publicContact)}
Proposal scope: ${JSON.stringify(creator.proposalScope||{})}

Return ONLY JSON: {"reason":"","subject":"","draft":"","auditFocus":[],"status":"drafted"}
Rules:
- Write in Turkish when country is Türkiye/Turkey; otherwise use clear English.
- Use ONLY supplied evidence. Never invent followers, engagement, views, revenue, demographics, brand deals, rankings, growth rates, contacts, or cross-platform identity.
- reason: one evidence-grounded reason for contacting this creator.
- draft: 55-100 words, respectful, creator-specific, no spam language.
- Mention at most two improvement opportunities supported by supplied evidence.
- Ask permission to share a short Creator Growth/Discoverability audit.
- Do not promise results.
- This is a DRAFT only; never imply it was sent.
- auditFocus: max 3 concise evidence-backed areas.`;
 const x=(await resilientJson(prompt,{temperature:.2,operation:"creator-personalization"})).data;
 return {reason:String(x?.reason||"").slice(0,700),subject:String(x?.subject||"").slice(0,180),draft:String(x?.draft||"").slice(0,3000),auditFocus:Array.isArray(x?.auditFocus)?x.auditFocus.slice(0,3).map(v=>String(v).slice(0,180)):[],status:"drafted"};
}


export async function analyzeCreatorReply(input={}){
 const prompt=`You are a careful Creator & Personal Brand sales reply analyst.
Creator: ${input.displayName||""}
Platform: ${input.platform||""}
Country: ${input.country||""}
Audit/offer scope: ${JSON.stringify(input.proposalScope||{})}
Creator reply: ${input.replyText||""}
Return ONLY JSON: {"classification":"interested|price-objection|info-request|meeting-request|not-interested|collaboration-question|other","crmStage":"reply|warm|proposal|lost","summary":"","draftReply":"","needsHuman":false,"stopContact":false}
Rules:
- Reply in the creator's language when clearly identifiable; otherwise Turkish for Türkiye and English elsewhere.
- Never invent price, discount, guaranteed growth, followers, views, revenue, engagement, demographics, brand deals, availability, capabilities, or contract terms.
- If price is asked/challenged and no approved creator price exists, say pricing/scope will be confirmed; do not invent a number.
- If they ask to stop/unsubscribe/not be contacted, set classification not-interested, crmStage lost, stopContact true, draftReply empty.
- Legal/privacy/complaint/refund/unusual commercial terms => needsHuman true.
- This is analysis + DRAFT only. Never imply a message was sent.`;
 const x=(await resilientJson(prompt,{temperature:.15,operation:"creator-reply-analysis"})).data,allowed=new Set(["interested","price-objection","info-request","meeting-request","not-interested","collaboration-question","other"]),stages=new Set(["reply","warm","proposal","lost"]);
 return {classification:allowed.has(x?.classification)?x.classification:"other",crmStage:stages.has(x?.crmStage)?x.crmStage:"reply",summary:String(x?.summary||"").slice(0,800),draftReply:String(x?.draftReply||"").slice(0,3500),needsHuman:Boolean(x?.needsHuman),stopContact:Boolean(x?.stopContact)};
}
