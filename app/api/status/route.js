import {integrationStatus} from "../../../lib/integration-status";
import {databaseStatus,getDatabaseUrl} from "../../../lib/db";
import {providerStatus} from "../../../lib/providers";
import {authConfigured} from "../../../lib/admin-auth";
import {recoveryStatus} from "../../../lib/recovery-sender";
import {requireAdmin} from "../../../lib/api-security";
import {probePaddleLiveApi} from "../../../lib/paddle-checkout";

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const providers=providerStatus();
  const paytrConfigured=Boolean(process.env.PAYTR_MERCHANT_ID&&process.env.PAYTR_MERCHANT_KEY&&process.env.PAYTR_MERCHANT_SALT);
  const paddleConfigured=Boolean(process.env.PADDLE_LIVE_API_KEY&&process.env.NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN&&process.env.PADDLE_LIVE_WEBHOOK_SECRET);
  const paddleLive=await probePaddleLiveApi({apiKey:process.env.PADDLE_LIVE_API_KEY||'',signal:AbortSignal.timeout(5000)});
  return Response.json({
    app:"AI Visibility",
    version:"0.9.2",
    database:databaseStatus(),
    providers,
    integrations:integrationStatus(),
    billing:{
      configured:paddleConfigured||paytrConfigured,
      provider:paddleConfigured?"Paddle LIVE":paytrConfigured?"PayTR":"none",
      paddle:{configured:paddleConfigured,liveApiVerified:paddleLive.authenticated,reachable:paddleLive.reachable,status:paddleLive.status,eventTypes:paddleLive.eventTypes},
      paytr:{configured:paytrConfigured}
    },
    auth:{configured:authConfigured(),recovery:recoveryStatus()},
    safeDemo:!getDatabaseUrl()||!providers.some(x=>x.status==="connected")
  },{headers:{"Cache-Control":"no-store"}});
}
// production-refresh-secure-checkout
// production-refresh-final-polish
// release-0.9.1
// release-0.9.2
