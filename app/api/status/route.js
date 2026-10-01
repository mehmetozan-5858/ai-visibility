import {databaseStatus,getDatabaseUrl} from "../../../lib/db";
import {providerStatus} from "../../../lib/providers";
import {authConfigured} from "../../../lib/admin-auth";
export async function GET(){
  const providers=providerStatus();
  return Response.json({
    app:"AI Visibility",
    version:"0.6.0",
    database:databaseStatus(),
    providers,
    billing:{configured:Boolean(process.env.PAYTR_MERCHANT_ID&&process.env.PAYTR_MERCHANT_KEY&&process.env.PAYTR_MERCHANT_SALT),provider:"PayTR"},
    auth:{configured:authConfigured()},
    safeDemo:!getDatabaseUrl()||!providers.some(x=>x.status==="connected")
  });
}