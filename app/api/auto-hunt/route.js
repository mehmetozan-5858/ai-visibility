import {saveDiscovered,qualifyDiscovered,listDiscovered} from "../../../lib/lead-finder";

export const runtime="nodejs";
const MARKETS=[
 ["Türkiye","İstanbul"],["Türkiye","Ankara"],["Türkiye","İzmir"],["Türkiye","Antalya"],["Türkiye","Bursa"],
 ["United Kingdom","London"],["Germany","Berlin"],["France","Paris"],["Netherlands","Amsterdam"],
 ["Italy","Milan"],["Spain","Madrid"],["United States","New York"],["Canada","Toronto"],["United Arab Emirates","Dubai"]
];
const SECTORS=["E-ticaret","Turizm ve otel","Gayrimenkul","Sağlık","Güzellik ve bakım","Restoran ve kafe","Otomotiv","Eğitim","Hukuk","Tekstil ve giyim","İnşaat","Yazılım ve teknoloji"];
function jsonFrom(s){const t=String(s||"").replace(/^\`\`\`json\s*/i,"").replace(/\`\`\`$/,"").trim(),a=t.indexOf("["),b=t.lastIndexOf("]");if(a<0||b<a)return [];try{return JSON.parse(t.slice(a,b+1))}catch{return []}}
function authorized(req){const expected=process.env.AUTO_HUNT_SECRET||"";const got=String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");return expected&&got&&got===expected}
export async function POST(req){
 if(!authorized(req))return Response.json({error:"Yetkisiz otomatik av isteği."},{status:401});
 try{
  const key=process.env.PERPLEXITY_API_KEY;if(!key)return Response.json({error:"PERPLEXITY_API_KEY yapılandırılmalı."},{status:503});
  const b=await req.json().catch(()=>({})),limit=Math.min(20,Math.max(5,Number(b.limitPerRun)||20));
  const slot=Math.floor(Date.now()/21600000),[country,city]=MARKETS[slot%MARKETS.length],sector=SECTORS[Math.floor(slot/MARKETS.length)%SECTORS.length];
  const prompt=`Find up to ${limit} real businesses in ${city}, ${country}, sector: ${sector}. Prioritize businesses with commercial ability to buy digital visibility services and a verifiable public website/contact path. Use current public web information. Return ONLY a JSON array. Each object: businessName, website, phone, email, sourceUrl. Never invent data; empty string if unverified. Exclude directories and duplicates.`;
  const rr=await fetch("https://api.perplexity.ai/chat/completions",{method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json"},body:JSON.stringify({model:process.env.PERPLEXITY_MODEL||"sonar",messages:[{role:"system",content:"You are a global B2B prospect research agent. Accuracy and commercial fit over quantity. Never fabricate."},{role:"user",content:prompt}],temperature:0.1})});
  if(!rr.ok)return Response.json({error:"Araştırma sağlayıcısı yanıt vermedi.",status:rr.status},{status:502});
  const d=await rr.json(),items=jsonFrom(d?.choices?.[0]?.message?.content).map(x=>({...x,country,city,sector}));
  const saved=await saveDiscovered(items);await qualifyDiscovered();
  const leaders=(await listDiscovered(20)).filter(x=>x.qualificationLevel==="hot").slice(0,10);
  return Response.json({ok:true,market:{country,city,sector},found:items.length,saved:saved.filter(x=>!x.duplicate).length,duplicates:saved.filter(x=>x.duplicate).length,hotLeads:leaders});
 }catch(e){return Response.json({error:"Global Auto Hunt çalıştırılamadı.",detail:String(e?.message||e).slice(0,180)},{status:500})}
}
