import {clients,executiveSummary} from "../../../lib/store";
import {providerStatus} from "../../../lib/providers";
export async function GET(){return Response.json({summary:executiveSummary({clientsCount:clients.filter(x=>x.status!=="demo").length}),providers:providerStatus(),mode:"demo"})}
