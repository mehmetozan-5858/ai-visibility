import {NextResponse} from "next/server";
import {verifyAdminToken,verifyClientToken,authConfigured} from "./lib/admin-auth";


// Only scheduled agent routes accept a scheduler credential. Admin/customer APIs still require their own sessions.
const AGENT_CYCLE_PATHS=new Set(["/api/outreach-cycle","/api/inbox-cycle","/api/cron/daily-cycle", "/api/creator-hunt", "/api/follow-up-cycle", "/api/implementation-cycle", "/api/remeasurement-cycle", "/api/predictive-guard", "/api/self-healing-cycle", "/api/strategy-learning-cycle", "/api/next-best-action-cycle", "/api/outcome-learning-cycle", "/api/policy-brain-cycle", "/api/opportunity-forecast-cycle", "/api/resource-orchestrator-cycle", "/api/profit-control-cycle", "/api/budget-guard-cycle", "/api/provider-health-cycle", "/api/truth-guard-cycle", "/api/system-watchdog-cycle", "/api/dependency-brain-cycle", "/api/mission-control-cycle", "/api/world-class-scorecard", "/api/improvement-brain-cycle", "/api/benchmark-intelligence-cycle", "/api/innovation-brain-cycle", "/api/dual-engine-command", "/api/creator-intelligence-cycle", "/api/creator-learning-cycle", "/api/creator-remeasurement-cycle", "/api/dual-engine-quality", "/api/creator-benchmark-innovation", "/api/unified-mission-control", "/api/dual-engine-ceo-report", "/api/creator-crm-cycle", "/api/creator-outreach-draft-cycle", "/api/creator-follow-up-learning", "/api/dual-engine-resource-economics", "/api/dual-engine-unit-economics", "/api/verified-revenue-attribution", "/api/commercial-truth-cycle"]);
export function authorizedAgentCycle(req){
  if(req.method!=="GET"||!AGENT_CYCLE_PATHS.has(req.nextUrl.pathname))return false;
  const auth=req.headers.get("authorization")||"";
  return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(secret=>auth===`Bearer ${secret}`);
}

export async function proxy(req){
  if(authorizedAgentCycle(req))return NextResponse.next();
  const {pathname}=req.nextUrl;
  const publicPages=["/","/hizmetler","/hakkimizda","/iletisim","/gizlilik","/kvkk","/iptal-iade","/mesafeli-hizmet-sozlesmesi","/musteri-giris","/musteri-sifre-sifirla","/demo","/yeni-musteri"];
  const publicPath=pathname==="/api/webhooks/resend"||pathname==="/login"||pathname==="/sifremi-unuttum"||publicPages.includes(pathname)||pathname==="/api/leads"||pathname.startsWith("/api/auth/")||pathname.startsWith("/api/client-auth/")||pathname.startsWith("/odeme")||pathname.startsWith("/api/payment")||pathname.startsWith("/api/paytr/")||pathname.startsWith("/api/cron/")||pathname==="/api/creator-hunt";
  if(publicPath)return NextResponse.next();

  if(!authConfigured()){
    if(pathname.startsWith("/api/"))return Response.json({error:"Kimlik doğrulama yapılandırması eksik."},{status:503,headers:{"cache-control":"no-store"}});
    return new NextResponse("Service temporarily unavailable.",{status:503,headers:{"cache-control":"no-store"}});
  }

  if(pathname==="/musteri-panel"||pathname.startsWith("/musteri-panel/")||pathname.startsWith("/api/client-portal")){
    const clientToken=req.cookies.get("ai_client")?.value||"";
    if(await verifyClientToken(clientToken))return NextResponse.next();
    if(pathname.startsWith("/api/"))return Response.json({error:"Müşteri oturumu gerekli."},{status:401,headers:{"cache-control":"no-store"}});
    const url=req.nextUrl.clone();url.pathname="/musteri-giris";url.search="";
    return NextResponse.redirect(url);
  }

  const token=req.cookies.get("ai_admin")?.value||"";
  if(await verifyAdminToken(token))return NextResponse.next();
  if(pathname.startsWith("/api/"))return Response.json({error:"Yetkisiz erişim."},{status:401,headers:{"cache-control":"no-store"}});
  const url=req.nextUrl.clone();url.pathname="/login";url.search="";
  return NextResponse.redirect(url);
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)"]};
