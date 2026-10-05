import {saveCreatorHuntLeads} from "../../../lib/creator-hunt";
export const runtime="nodejs"; export const maxDuration=300;
const PLATFORMS=["youtube","instagram","tiktok","x","linkedin","facebook"];
const NICHES=["fashion","beauty","fitness","food","travel","technology","education","finance","gaming","parenting","automotive","health","business","lifestyle"];
const MARKETS=[["Türkiye","tr"],["United Kingdom","en"],["Germany","de"],["France","fr"],["Italy","it"],["Spain","es"],["United States","en"],["Canada","en"],["United Arab Emirates","en"],["Australia","en"],["Japan","ja"]];
function ok(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(s=>a===`Bearer ${s}`)}
function parse(text){const t=String(text||"").replace(/^```json\s*/i,"").replace(/```$/,"").trim();try{const j=JSON.parse(t);return Array.isArray(j)?j:(Array.isArray(j?.creators)?j.creators:[])}catch{}const a=t.indexOf("["),b=t.lastIndexOf("]");if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1))}catch{}}return[]}
function extractAgent(d){const m=(d?.output||[]).find(x=>x?.type==="message");return (m?.content||[]).find(x=>x?.type==="output_text")?.text||""}
async function perplexity(prompt,key){
 const r=await fetch("https://api.perplexity.ai/v1/agent",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${key}`},body:JSON.stringify({preset:process.env.PERPLEXITY_PRESET||"fast",input:prompt})});
 if(!r.ok)throw new Error(`perplexity-${r.status}: ${(await r.text()).slice(0,180)}`);return extractAgent(await r.json())
}
async function gemini(prompt,key){
 const model=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
 const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.1,responseMimeType:"application/json"}})});
 if(!r.ok)throw new Error(`gemini-${r.status}: ${(await r.text()).slice(0,180)}`);const d=await r.json();return d?.candidates?.[0]?.content?.parts?.[0]?.text||""
}
export async function GET(req){
 if(!ok(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 const slot=Math.floor(Date.now()/3600000),platform=PLATFORMS[slot%PLATFORMS.length],niche=NICHES[slot%NICHES.length],[country,language]=MARKETS[slot%MARKETS.length];
 const prompt=`You are a creator research agent with public web evidence. Find up to 12 REAL public creator/personal-brand accounts on ${platform} in or strongly associated with ${country}, niche ${niche}. Prefer genuine commercial potential plus visible discoverability/content/profile improvement opportunity. Return ONLY JSON: {"creators":[{"platform":"","handle":"","displayName":"","profileUrl":"","niche":"","country":"","language":"","publicContact":"","sourceUrl":"","opportunityScore":0,"evidence":{}}]}. publicContact only when clearly public business contact, otherwise empty. Never invent accounts, followers, engagement, demographics, revenue or contact data. sourceUrl/profileUrl must support identity.`;
 const errors=[];let text="",provider="";
 if(process.env.PERPLEXITY_API_KEY){try{text=await perplexity(prompt,process.env.PERPLEXITY_API_KEY);provider="Perplexity"}catch(e){errors.push(String(e?.message||e))}}
 if(!text&&process.env.GEMINI_API_KEY){try{text=await gemini(prompt,process.env.GEMINI_API_KEY);provider="Gemini"}catch(e){errors.push(String(e?.message||e))}}
 if(!text){console.error(JSON.stringify({source:"creator-hunt",event:"provider-failed",platform,country,niche,errors}));return Response.json({ok:false,error:"creator-provider-failed",errors},{status:502})}
 const items=parse(text).map(x=>({...x,platform:x.platform||platform,country:x.country||country,language:x.language||language,niche:x.niche||niche})).filter(x=>x.displayName&&x.profileUrl);
 const saved=await saveCreatorHuntLeads(items);
 console.log(JSON.stringify({source:"creator-hunt",event:"completed",provider,platform,country,niche,found:items.length,saved:saved.length,at:new Date().toISOString()}));
 return Response.json({ok:true,provider,platform,country,niche,found:items.length,saved:saved.length,top:saved.slice(0,5),providerErrors:errors});
}
