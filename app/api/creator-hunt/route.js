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
 const slot=Math.floor(Date.now()/3600000);
 const width=Math.max(2,Math.min(Number(process.env.PARALLEL_CREATOR_HUNT_CELLS)||3,5));
 const cells=Array.from({length:width},(_,i)=>{
  const n=slot*width+i;
  const platform=PLATFORMS[n%PLATFORMS.length],niche=NICHES[(n*5+i)%NICHES.length],[country,language]=MARKETS[(n*7+i)%MARKETS.length];
  return {platform,niche,country,language};
 });
 const runCell=async cell=>{
  const {platform,niche,country,language}=cell;
  const prompt=`You are a creator research agent with public web evidence. Find up to 8 REAL public creator/personal-brand accounts on ${platform} in or strongly associated with ${country}, niche ${niche}. Prefer genuine commercial potential plus visible discoverability/content/profile improvement opportunity. Return ONLY JSON: {"creators":[{"platform":"","handle":"","displayName":"","profileUrl":"","niche":"","country":"","language":"","publicContact":"","sourceUrl":"","opportunityScore":0,"creatorTier":"","growthScore":0,"monetizationScore":0,"brandReadinessScore":0,"aiDiscoverabilityScore":0,"crossPlatformScore":0,"evidence":{}}]}. Score fields must be 0-100 and only reflect evidence visible in public sources; use 0 when evidence is insufficient. creatorTier may be emerging, growth, established, expert-personal-brand, founder-executive, artist-entertainer, athlete, educator, streamer-gamer, local-influencer, niche-authority. publicContact only when clearly public business contact, otherwise empty. Never invent accounts, followers, engagement, demographics, revenue, contact data or cross-platform identity. sourceUrl/profileUrl must support identity.`;
  const errors=[];let text="",provider="";
  if(process.env.PERPLEXITY_API_KEY){try{text=await perplexity(prompt,process.env.PERPLEXITY_API_KEY);provider="Perplexity"}catch(e){errors.push(String(e?.message||e))}}
  if(!text&&process.env.GEMINI_API_KEY){try{text=await gemini(prompt,process.env.GEMINI_API_KEY);provider="Gemini"}catch(e){errors.push(String(e?.message||e))}}
  if(!text)return {...cell,ok:false,found:0,saved:0,errors};
  const items=parse(text).map(x=>({...x,platform:x.platform||platform,country:x.country||country,language:x.language||language,niche:x.niche||niche})).filter(x=>x.displayName&&x.profileUrl);
  return {...cell,ok:true,provider,found:items.length,items,errors};
 };
 const results=await Promise.allSettled(cells.map(runCell));
 const completed=results.map((r,i)=>r.status==="fulfilled"?r.value:{...cells[i],ok:false,found:0,saved:0,errors:[String(r.reason?.message||r.reason)]});
 const seen=new Set(),all=[];
 for(const r of completed)for(const x of r.items||[]){const k=`${String(x.platform||"").toLowerCase()}|${String(x.profileUrl||"").toLowerCase()}`;if(!seen.has(k)){seen.add(k);all.push(x)}}
 const ranked=all.sort((a,b)=>(Number(b.opportunityScore)||0)-(Number(a.opportunityScore)||0)).slice(0,20);
 const saved=await saveCreatorHuntLeads(ranked);
 const totalFound=completed.reduce((n,x)=>n+Number(x.found||0),0),errors=completed.flatMap(x=>x.errors||[]);
 console.log(JSON.stringify({source:"creator-hunt",event:"parallel-completed",cells:completed.map(({items,...x})=>x),found:totalFound,deduped:all.length,saved:saved.length,at:new Date().toISOString()}));
 return Response.json({ok:saved.length>0||completed.some(x=>x.ok),mode:"parallel",cells:completed.map(({items,...x})=>x),found:totalFound,deduped:all.length,saved:saved.length,top:saved.slice(0,5),providerErrors:errors});
}
