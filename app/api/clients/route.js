import {clients} from "../../../lib/store";
export async function GET(){return Response.json({clients})}
export async function POST(req){const body=await req.json();if(!body?.name||!body?.domain)return Response.json({error:"name and domain required"},{status:400});const client={id:crypto.randomUUID(),name:body.name,domain:body.domain,plan:body.plan||"Starter",status:"pending",visibilityScore:0,competitors:body.competitors||[]};return Response.json({client,note:"Prototype API: persistent database is the next milestone."},{status:201})}
