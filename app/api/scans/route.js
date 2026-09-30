import {createScan} from "../../../lib/store";
export async function POST(req){const body=await req.json();if(!body?.clientId)return Response.json({error:"clientId required"},{status:400});const scan=createScan(body.clientId,body.queries||[]);return Response.json({scan,mode:"demo",note:"Queued locally; live provider adapters are not connected yet."},{status:202})}
