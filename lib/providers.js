import {recordProviderHealth,chooseHealthyProvider} from "./agent-coordination";
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

Return ONLY valid JSON with this exact shape:
{"score":0,"summary":"","findings":[""],"recommendations":[""],"reason":""}

Rules:
- score must be 0-100 and reflect only the evidence available in the supplied business data; if evidence is weak, keep confidence conservative.
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
    const {text}=await generateText({
      model:process.env.OPENAI_GATEWAY_MODEL||"openai/gpt-5-nano",
      prompt:promptFor(p)
    });
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
  try{const result=normalizeProviderResult(await runner(prospect));await recordProviderHealth({provider:name,ok:Boolean(result),latencyMs:Date.now()-started,error:result?"":"no-result"}).catch(()=>null);return result}
  catch(e){await recordProviderHealth({provider:name,ok:false,latencyMs:Date.now()-started,error:String(e?.message||e)}).catch(()=>null);throw e}
}
export async function runProviderChecks(prospect){
  const entries=[["ChatGPT",runOpenAI],["Gemini",runGemini],["Perplexity",runPerplexity]].filter(([name])=>configured(name));
  const settled=await Promise.allSettled(entries.map(async([name,runner])=>({name,result:await observedRun(name,runner,prospect)})));
  const results=[],errors=[];settled.forEach((item,i)=>{const name=entries[i]?.[0]||"Provider";if(item.status==="fulfilled"&&item.value?.result)results.push(item.value.result);else errors.push({provider:name,error:item.status==="rejected"?String(item.reason?.message||item.reason):"no-result"})});
  return {results,errors};
}
export async function runProviderCheck(prospect){
  const available=[["ChatGPT",runOpenAI],["Gemini",runGemini],["Perplexity",runPerplexity]].filter(([name])=>configured(name));
  const remaining=[...available],errors=[];
  while(remaining.length){
    const preferred=await chooseHealthyProvider(remaining.map(x=>x[0])).catch(()=>remaining[0][0]);
    const idx=Math.max(0,remaining.findIndex(x=>x[0]===preferred)),[name,runner]=remaining.splice(idx,1)[0];
    try{const result=await observedRun(name,runner,prospect);if(result)return result}catch(e){errors.push({provider:name,error:String(e?.message||e)})}
  }
  return null;
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

  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      contents:[{parts:[{text:prompt}]}],
      generationConfig:{temperature:0.2,responseMimeType:"application/json"}
    })
  });
  if(!r.ok) throw new Error(`gemini-${r.status}`);
  const d=await r.json();
  return parseJson(d?.candidates?.[0]?.content?.parts?.[0]?.text||"");
}


export async function discoverBusinesses({country="Türkiye",city="Sivas",sector="",existingNames=[]}={}){
  const key=process.env.PERPLEXITY_API_KEY;
  if(!key) throw new Error("perplexity-key-missing");

  const targetSectors=[
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
    "Tekstil / Giyim"
  ];

  const selectedSector=targetSectors.includes(sector)?sector:"";
  const sectorRules=selectedSector
    ? `- Return exactly 12 businesses from this sector only: ${selectedSector}.
- Do not mix in other sectors.`
    : `- Return exactly 12 businesses.
- Use at least 8 different sectors from this list:
${targetSectors.map((s,i)=>`${i+1}. ${s}`).join("\n")}
- Maximum 2 businesses from the same sector.
- Maximum 2 hotels/tourism businesses total.`;

  const prompt=`You are a local business research agent with web access.

Find REAL, CURRENT businesses in ${city}, ${country} for AI visibility/GEO-AEO sales outreach.

SECTOR RULES:
${sectorRules}

VERIFICATION RULES:
- Prefer locally owned or regional businesses over national chains when possible.
- Do NOT return any of these existing businesses: ${JSON.stringify(existingNames||[])}
- Every business must be real and currently operating.
- Each item must have an official website/domain or a clearly identifiable official web presence.
- Do not invent businesses, domains, rankings, reviews, traffic, or contacts.
- If a candidate cannot be verified, omit it and find another.

Return ONLY valid JSON:
{"businesses":[{"name":"","domain":"","sector":"${selectedSector||"one listed sector"}","city":"${city}","country":"${country}","source":"perplexity-web"}]}

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
    out.push({name,domain,sector:itemSector,city:String(x.city||city).trim(),country:String(x.country||country).trim(),source:"perplexity-web"});
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

  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:"application/json"}})
  });
  if(!r.ok) throw new Error(`gemini-${r.status}`);
  const d=await r.json();
  return parseJson(d?.candidates?.[0]?.content?.parts?.[0]?.text||"");
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

  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      contents:[{parts:[{text:prompt}]}],
      generationConfig:{temperature:0.15,responseMimeType:"application/json"}
    })
  });
  if(!r.ok) throw new Error(`gemini-${r.status}`);
  const d=await r.json();
  return parseJson(d?.candidates?.[0]?.content?.parts?.[0]?.text||"");
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
  const key=process.env.GEMINI_API_KEY;if(!key)throw new Error("gemini-key-missing");
  const model=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
  const prompt=`You are a careful B2B personalization agent for an AI visibility/GEO-AEO service.
Business: ${prospect.name}
Website: ${prospect.domain||""}
Sector/location: ${prospect.sector||""}, ${prospect.city||""}, ${prospect.country||""}
AI visibility analysis: ${JSON.stringify({score:scanResult?.score,summary:scanResult?.summary,findings:scanResult?.findings,recommendations:scanResult?.recommendations})}
Verified public contact status: ${contact?.status||"unknown"}

Return ONLY JSON:
{"reason":"","draft":"","status":"drafted"}

Rules:
- Turkish.
- Use ONLY supplied evidence; never invent rankings, revenue, traffic, reviews, competitors or contacts.
- reason: one concrete sentence explaining why this business is worth contacting.
- draft: 60-110 words, respectful and genuinely personalized to the evidence.
- Mention at most 1-2 observed improvement areas.
- Do not claim guaranteed results.
- Ask permission to share a short analysis/summary.
- This is a DRAFT only. Never imply it was sent.`;
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:"application/json"}})});
  if(!r.ok)throw new Error(`gemini-personalization-${r.status}`);
  const d=await r.json();const x=parseJson(d?.candidates?.[0]?.content?.parts?.[0]?.text||"");
  return {reason:String(x?.reason||""),draft:String(x?.draft||""),status:"drafted"};
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
  const score=Number(scanResult?.score)||0;
  const packageName=score<55?"AI Visibility Solution":score<75?"AI Visibility Diagnosis":"AI Visibility Monitoring";
  const amount=packageName==="AI Visibility Solution"?pricing.solution:packageName==="AI Visibility Diagnosis"?pricing.diagnosis:pricing.monitoring;
  const reason=personalized?.reason||scanResult?.reason||"AI görünürlük analizine göre uygun hizmet paketi.";
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
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.15,responseMimeType:"application/json"}})});
  if(!r.ok)throw new Error(`gemini-reply-${r.status}`);
  const d=await r.json(),x=parseJson(d?.candidates?.[0]?.content?.parts?.[0]?.text||"");
  const allowed=new Set(["interested","price-objection","info-request","meeting-request","not-interested","other"]);
  return {classification:allowed.has(x?.classification)?x.classification:"other",crmStatus:String(x?.crmStatus||"replied"),summary:String(x?.summary||"").slice(0,800),draftReply:String(x?.draftReply||"").slice(0,4000),needsHuman:Boolean(x?.needsHuman)};
}
