import {addClient,findClientByIdentity} from "../../../../lib/repository";
import {upsertClientProfile} from "../../../../lib/client-profile";
import {requireAdmin,enforceSameOrigin} from "../../../../lib/api-security";

/**
 * Intentionally disabled by default. No import of pilot routes or preview DB.
 * Requires a separate operator-controlled environment flag after review.
 * Does not create scans or grant customer/admin access.
 */
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const origin=enforceSameOrigin(req);if(origin)return origin;
 if(process.env.VERCEL_ENV!=="production"||process.env.ZERA_PRODUCTION_ONBOARD_ENABLED!=="true")
  return Response.json({error:"Production onboarding disabled"},{status:403});
 let body;
 try{body=await req.json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
 if(body?.confirmZeraProductionOnboard!==true||Object.keys(body).length!==1)
  return Response.json({error:"Explicit onboarding confirmation required"},{status:400});
 try{
  const name="ZERA Clothing";
  const existing=await findClientByIdentity(name,"");
  if(existing&&(existing.name?.trim().toLocaleLowerCase("en")!==name.toLocaleLowerCase("en")||String(existing.domain||"").trim()))
   return Response.json({error:"Existing identity requires review"},{status:409});
  const client=existing||await addClient({name,domain:"",plan:"Pilot",competitors:[]});
  if(!client?.id||(!existing&&!client.persisted))
   return Response.json({error:"Persistent customer registration unavailable"},{status:503});
  await upsertClientProfile(client.id,{country:"Germany",city:"Wetzlar",sector:"Women's clothing",requestedService:"Public-scope GEO/AEO pilot"});
  return Response.json({clientId:client.id,created:!existing,plan:"Pilot",scanExecuted:false,paymentCreated:false},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return Response.json({error:"Onboarding failed; verify existing record before retry"},{status:500})}
}
