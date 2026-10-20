import {PADDLE_SERVICE_CODES} from './regional-pricing.js';

// Configuration is not merchant/domain approval. Enable only after provider review.
export function paddleLiveReadiness({service,origin,env=process.env}={}){
 const configured=['PADDLE_LIVE_API_KEY','NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN','PADDLE_LIVE_WEBHOOK_SECRET']
  .every(key=>typeof env[key]==='string'&&env[key].trim().length>0);
 const production=env.VERCEL_ENV==='production';
 const sellerApproved=env.PADDLE_LIVE_SELLER_APPROVED==='true';
 const serviceEligible=PADDLE_SERVICE_CODES.includes(service);
 let domainApproved=false;
 try{
  const url=new URL(origin),domains=JSON.parse(env.PADDLE_LIVE_APPROVED_DOMAINS||'[]');
  const host=/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
  domainApproved=url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&Array.isArray(domains)
   &&domains.length>0&&domains.every(d=>typeof d==='string'&&host.test(d))&&domains.includes(url.hostname);
 }catch{}
 return {configured,production,sellerApproved,domainApproved,serviceEligible,
  ready:configured&&production&&sellerApproved&&domainApproved&&serviceEligible};
}
