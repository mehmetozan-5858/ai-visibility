function langCode(value){
  const v=String(value||"").toLowerCase();
  return v.startsWith("en")?"en":"tr";
}

function languageInstruction(language){
  return langCode(language)==="en"
    ? "Write all human-readable text in natural professional English. Preserve technical terms, numbers, URLs, schema keys and factual meaning exactly. Do not translate brand names or invent facts."
    : "Tüm kullanıcıya dönük metinleri doğal ve profesyonel Türkçe yaz. Teknik terimleri, sayıları, URL'leri, schema anahtarlarını ve olgusal anlamı aynen koru. Marka adlarını çevirme ve bilgi uydurma.";
}

function parseJson(text){
  const clean=String(text||"").replace(/^```json\s*/i,"").replace(/```$/i,"").trim();
  try{return JSON.parse(clean)}catch{}
  const a=clean.indexOf("{"),b=clean.lastIndexOf("}");
  if(a>=0&&b>a)return JSON.parse(clean.slice(a,b+1));
  throw new Error("provider-json-invalid");
}

async function geminiJson(prompt,temperature=.2){
  const key=process.env.GEMINI_API_KEY;
  if(!key)throw new Error("gemini-key-missing");
  const model=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature,responseMimeType:"application/json"}})
  });
  if(!r.ok)throw new Error(`gemini-${r.status}`);
  const d=await r.json();
  return parseJson(d?.candidates?.[0]?.content?.parts?.[0]?.text||"");
}

function visibilityPrompt(p,language){
  return `You are an AI visibility/GEO-AEO analyst. Analyze this business as a prospect for an AI visibility service.\nBusiness: ${p.name}\nWebsite: ${p.domain||"unknown"}\nSector: ${p.sector||"unknown"}\nCity: ${p.city||"unknown"}\nCountry: ${p.country||"unknown"}\n\nReturn ONLY valid JSON with this exact shape:\n{"score":0,"summary":"","findings":[""],"recommendations":[""],"reason":""}\n\nRules:\n- score must be 0-100 and reflect only supplied/verified evidence; if evidence is weak, keep confidence conservative.\n- Do not invent rankings, reviews, traffic, citations, competitor facts or business facts.\n- findings: 2-5 concrete observations framed as things to verify or improve.\n- recommendations: 2-5 practical GEO/AEO actions.\n- reason: one short sales-relevance sentence.\n- ${languageInstruction(language)}`;
}

async function runOpenAI(p,language){
  const directKey=process.env.OPENAI_API_KEY||process.env.AI_PROVIDER_API_KEY;
  if(directKey){
    const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${directKey}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",temperature:.2,response_format:{type:"json_object"},messages:[{role:"user",content:visibilityPrompt(p,language)}]})});
    if(!r.ok)throw new Error(`openai-${r.status}`);
    const d=await r.json();return {provider:"ChatGPT",...parseJson(d?.choices?.[0]?.message?.content||"")};
  }
  if(process.env.VERCEL||process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN){
    const {generateText}=await import("ai");
    const {text}=await generateText({model:process.env.OPENAI_GATEWAY_MODEL||"openai/gpt-5-nano",prompt:visibilityPrompt(p,language)});
    return {provider:"ChatGPT",...parseJson(text||"")};
  }
  return null;
}

async function runGemini(p,language){
  if(!process.env.GEMINI_API_KEY)return null;
  return {provider:"Gemini",...(await geminiJson(visibilityPrompt(p,language),.2))};
}

async function runPerplexity(p,language){
  const key=process.env.PERPLEXITY_API_KEY;if(!key)return null;
  const r=await fetch("https://api.perplexity.ai/v1/agent",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${key}`},body:JSON.stringify({preset:process.env.PERPLEXITY_PRESET||"fast",input:visibilityPrompt(p,language)})});
  if(!r.ok)throw new Error(`perplexity-${r.status}`);
  const d=await r.json();const message=(d?.output||[]).find(x=>x?.type==="message");const text=(message?.content||[]).find(x=>x?.type==="output_text")?.text||"";
  return {provider:"Perplexity",...parseJson(text)};
}

export async function runLocalizedProviderChecks(prospect,language="tr"){
  const jobs=[];
  if(process.env.OPENAI_API_KEY||process.env.AI_PROVIDER_API_KEY||process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN||process.env.VERCEL)jobs.push(["ChatGPT",runOpenAI]);
  if(process.env.GEMINI_API_KEY)jobs.push(["Gemini",runGemini]);
  if(process.env.PERPLEXITY_API_KEY)jobs.push(["Perplexity",runPerplexity]);
  const settled=await Promise.allSettled(jobs.map(([,fn])=>fn(prospect,language)));
  const results=[],errors=[];
  settled.forEach((x,i)=>{const name=jobs[i]?.[0]||"Provider";if(x.status==="fulfilled"&&x.value){const score=Math.max(0,Math.min(100,Number(x.value.score)||0));results.push({...x.value,score,findings:Array.isArray(x.value.findings)?x.value.findings:[],recommendations:Array.isArray(x.value.recommendations)?x.value.recommendations:[]});}else errors.push({provider:name,error:String(x.reason?.message||x.reason||"no-result")});});
  return {results,errors,language:langCode(language)};
}

export async function runLocalizedContentPlan(input,language="tr"){
  const prompt=`You are a GEO/AEO content strategist. Create a concise content improvement plan from this completed visibility scan.\nBusiness: ${input.clientName||""}\nScore: ${input.score??""}/100\nSummary: ${input.summary||""}\nFindings: ${JSON.stringify(input.findings||[])}\nRecommendations: ${JSON.stringify(input.recommendations||[])}\n\nReturn ONLY valid JSON:\n{"headline":"","priorities":[""],"contentIdeas":[{"title":"","format":"","goal":""}],"quickWins":[""]}\nRules:\n- 3 priorities, 4 content ideas, 3 quick wins.\n- Do not invent rankings, reviews, traffic or competitor facts.\n- ${languageInstruction(language)}`;
  return geminiJson(prompt,.2);
}

export async function runLocalizedImplementationPlan(input,language="tr"){
  const unknownAddress=langCode(language)==="en"?"[CUSTOMER-APPROVED ADDRESS]":"[MÜŞTERİDEN ONAYLI ADRES]";
  const prompt=`You are a GEO/AEO implementation specialist. Turn this completed AI visibility audit into an implementation-ready work package.\nBusiness: ${input.clientName||""}\nWebsite: ${input.domain||""}\nOverall score: ${input.score??""}/100\nProvider results: ${JSON.stringify(input.results||[])}\n\nReturn ONLY valid JSON:\n{"headline":"","readyNow":[{"title":"","type":"FAQ|META|SCHEMA|CONTENT|LOCATION_PAGE","deliverable":""}],"accessRequired":[{"title":"","system":"Website|Google Business Profile|Other","action":""}],"approvalRequired":[{"field":"","reason":""}],"faq":[{"q":"","a":""}],"meta":{"title":"","description":""},"schema":{"type":"","jsonLd":{}},"locationPage":{"title":"","outline":[""]},"nextSteps":[""]}\nRules:\n- Never invent address, phone, opening hours, prices, menu items, ratings, awards or credentials.\n- If a fact is unknown, use placeholders like ${unknownAddress}.\n- Provide 3-5 readyNow items and 1-4 accessRequired items.\n- faq: 3 concise Q&A items using no invented facts.\n- schema.jsonLd must remain valid JSON-LD style data and schema property names must stay unchanged.\n- ${languageInstruction(language)}`;
  return geminiJson(prompt,.15);
}

export function resolveRequestLanguage(req,body){
  const explicit=body?.language||body?.lang;
  if(explicit)return langCode(explicit);
  const cookie=String(req?.headers?.get?.("cookie")||"").match(/(?:^|;\s*)ai_lang=(tr|en)(?:;|$)/i)?.[1];
  if(cookie)return langCode(cookie);
  return langCode(req?.headers?.get?.("accept-language")||"tr");
}
