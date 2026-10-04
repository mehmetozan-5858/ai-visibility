import {addClient,listClients} from "../../../lib/repository";
import {listClientProfiles,upsertClientProfile} from "../../../lib/client-profile";
import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{
    const [clients,profiles]=await Promise.all([listClients(),listClientProfiles()]);
    const byId=new Map(profiles.map(x=>[x.clientId,x]));
    return Response.json({clients:clients.map(x=>({...x,profile:byId.get(x.id)||null}))});
  }catch(e){return Response.json({error:"database unavailable"},{status:503})}
}
export async function POST(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const originError=enforceSameOrigin(req);if(originError)return originError;
  try{
    const body=await req.json();
    if(!body?.name?.trim()||!body?.domain?.trim())return Response.json({error:"Marka adı ve web sitesi zorunlu."},{status:400});
    const client=await addClient({name:body.name.trim(),domain:body.domain.trim(),plan:body.plan||"Starter",competitors:Array.isArray(body.competitors)?body.competitors:[]});
    if(client?.persisted){
      await upsertClientProfile(client.id,{country:body.country,city:body.city,sector:body.sector,phone:body.phone,contactEmail:body.contactEmail});
    }
    return Response.json({client,mode:client.persisted?"database":"demo-only"},{status:201});
  }catch(e){return Response.json({error:"Müşteri kaydedilemedi."},{status:500})}
}
