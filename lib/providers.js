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

export async function runProviderChecks(prospect){
  const entries=[
    ["ChatGPT",runOpenAI],
    ["Gemini",runGemini],
    ["Perplexity",runPerplexity]
  ].filter(([name])=>configured(name));

  const settled=await Promise.allSettled(entries.map(async([name,runner])=>{
    const result=await runner(prospect);
    return {name,result:normalizeProviderResult(result)};
  }));

  const results=[],errors=[];
  settled.forEach((item,i)=>{
    const name=entries[i]?.[0]||"Provider";
    if(item.status==="fulfilled"&&item.value?.result)results.push(item.value.result);
    else errors.push({provider:name,error:item.status==="rejected"?String(item.reason?.message||item.reason):"no-result"});
  });
  return {results,errors};
}

export async function runProviderCheck(prospect){
  const {results}=await runProviderChecks(prospect);
  return results[0]||null;
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
