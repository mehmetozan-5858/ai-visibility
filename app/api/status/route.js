import {databaseStatus,getDatabaseUrl} from "../../../lib/db";
import {providerStatus} from "../../../lib/providers";
export async function GET(){
  const providers=providerStatus();
  return Response.json({
    app:"AI Visibility",
    version:"0.6.0",
    database:databaseStatus(),
    providers,
    billing:{configured:Boolean(process.env.BILLING_SECRET_KEY)},
    safeDemo:!getDatabaseUrl()||!providers.some(x=>x.status==="connected")
  });
}