import {addClient,listClients} from "../../../lib/repository";
export async function GET(){return Response.json({clients:await listClients()})}
export async function POST(req){const body=await req.json();if(!body?.name||!body?.domain)return Response.json({error:"name and domain required"},{status:400});const client=await addClient({name:body.name,domain:body.domain,plan:body.plan||"Starter",competitors:body.competitors||[]});return Response.json({client,mode:"demo-persistence"},{status:201})}
