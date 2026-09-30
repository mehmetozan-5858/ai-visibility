import {databaseStatus} from "../../../lib/db";
import {providerStatus} from "../../../lib/providers";
export async function GET(){return Response.json({app:"AI Visibility",version:"0.4.0",database:databaseStatus(),providers:providerStatus(),billing:{configured:Boolean(process.env.BILLING_SECRET_KEY)},safeDemo:!process.env.DATABASE_URL})}
