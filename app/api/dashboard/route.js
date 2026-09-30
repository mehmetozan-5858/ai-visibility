import {getDashboard} from "../../../lib/repository";
import {providerStatus} from "../../../lib/providers";
export async function GET(){return Response.json({summary:await getDashboard(),providers:providerStatus(),mode:"demo"})}
