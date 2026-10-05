import {saveCreatorHuntLeads,listCreatorHuntLeads} from "../../../lib/creator-hunt";
export const runtime="nodejs"; export const maxDuration=300;
const PLATFORMS=["youtube","instagram","tiktok","x","linkedin","facebook"];
const NICHES=["fashion","beauty","fitness","food","travel","technology","education","finance","gaming","parenting","automotive","health","business","lifestyle"];
const MARKETS=[["Türkiye","tr"],["United Kingdom","en"],["Germany","de"],["France","fr"],["Italy","it"],["Spain","es"],["United States","en"],["Canada","en"],["United Arab Emirates","en"],["Australia","en"],["Japan","ja"]];
function ok(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(s=>a===`Bearer ${s}`)}
function arr(s){const t=String(s||"").replace(/^```json\s*/i,"").replace(/```$/,"").trim(),a=t.indexOf("["),b=t.lastIndexOf("]");if(a<0||b<a)return[];try{return JSON.parse(t.slice(a,b+1))}catch{return[]}}
export async function GET(req){
 if(!ok(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 const key=process.env.PERPLEXITY_API_KEY;if(!key)return Response.json({ok:false,error:"provider-not-configured"},{status:503});
 const slot=Math.floor(Date.now()/3600000),platform=PLATFORMS[slot%PLATFORMS.length],niche=NICHES[slot%NICHES.length],[country,language]=MARKETS[slot%MARKETS.length];
 const prompt=`Find up to 12 real public creator/personal-brand accounts on ${platform} in or strongly associated with ${country}, niche ${niche}. Use current public web evidence. Prefer creators with a genuine audience/business opportunity and visible room for discoverability, content, profile, retention or monetization improvement. Return ONLY JSON array with: platform, handle, displayName, profileUrl, niche, country, language, publicContact, sourceUrl, opportunityScore, evidence. publicContact must only contain a clearly public business contact/email or empty string. opportunityScore 0-100 must reflect creator-commercial fit plus visible improvement opportunity. evidence must be a short object of public facts supporting the score. Never invent followers, engagement, contact data, revenue or demographics. Do not send messages and do not claim private analytics.`;
 const rr=await fetch("https://api.perplexity.ai/chat/completions",{method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json"},body:JSON.stringify({model:process.env.PERPLEXITY_MODEL||"sonar",messages:[{role:"system",content:"You are Creator Scout Agent. Accuracy and public evidence over quantity. Never fabricate accounts, metrics or contacts."},{role:"user",content:prompt}],temperature:.1})});
 if(!rr.ok)return Response.json({ok:false,error:"creator-provider-failed",status:rr.status},{status:502});
 const d=await rr.json(),items=arr(d?.choices?.[0]?.message?.content).map(x=>({...x,platform:x.platform||platform,country:x.country||country,language:x.language||language,niche:x.niche||niche}));
 const saved=await saveCreatorHuntLeads(items);
 console.log(JSON.stringify({source:"creator-hunt",event:"completed",platform,country,niche,found:items.length,saved:saved.length,at:new Date().toISOString()}));
 return Response.json({ok:true,platform,country,niche,found:items.length,saved:saved.length,top:saved.slice(0,5)});
}
