import {verifyAdminToken} from "./admin-auth";

const globalStore=globalThis.__aiVisibilityRateLimits||(globalThis.__aiVisibilityRateLimits=new Map());

function clientIp(req){
  const raw=req.headers.get("x-forwarded-for")||req.headers.get("x-real-ip")||"unknown";
  return String(raw).split(",")[0].trim().slice(0,120);
}

export async function requireAdmin(req){
  const token=req?.cookies?.get?.("ai_admin")?.value||"";
  if(!await verifyAdminToken(token))return Response.json({error:"Yetkisiz erişim."},{status:401});
  return null;
}

export function enforceSameOrigin(req){
  const origin=req.headers.get("origin");
  if(!origin)return null;
  try{
    const originHost=new URL(origin).host;
    const host=req.headers.get("x-forwarded-host")||req.headers.get("host")||"";
    if(originHost!==host)return Response.json({error:"Geçersiz istek kaynağı."},{status:403});
  }catch{return Response.json({error:"Geçersiz istek kaynağı."},{status:403})}
  return null;
}

export function checkRateLimit(req,{bucket="default",limit=8,windowMs=15*60*1000}={}){
  const now=Date.now();
  const key=bucket+":"+clientIp(req);
  let row=globalStore.get(key);
  if(!row||row.resetAt<=now)row={count:0,resetAt:now+windowMs};
  row.count+=1;globalStore.set(key,row);
  if(row.count<=limit)return null;
  const retry=Math.max(1,Math.ceil((row.resetAt-now)/1000));
  const res=Response.json({error:"Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin."},{status:429});
  res.headers.set("Retry-After",String(retry));
  return res;
}

export function clearRateLimit(req,bucket="default"){
  globalStore.delete(bucket+":"+clientIp(req));
}
