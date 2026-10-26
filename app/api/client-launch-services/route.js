import {cookies} from "next/headers";
import {verifyClientToken} from "../../../lib/admin-auth";
import {getClientAccount} from "../../../lib/repository";
import {customerAccess} from "../../../lib/pilot-access";
import {resolveClientLaunchReadAccess} from "../../../lib/ai-visibility-client-launch-access.mjs";
import {listLaunchServices} from "../../../lib/ai-visibility-launch-services.mjs";

const json=(body,status=200)=>Response.json(body,{
  status,headers:{"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie"},
});

/** Read-only preview for the EXISTING AI Visibility customer portal. */
export async function GET(){
  try{
    const store=await cookies();
    const session=await verifyClientToken(store.get("ai_client")?.value||"");
    if(!session)return json({error:"Oturum gerekli."},401);
    const account=await getClientAccount(session.clientId);
    if(!account)return json({error:"Müşteri bulunamadı."},404);
    const access=await customerAccess(account);
    const policy=resolveClientLaunchReadAccess({session,account,access});
    if(!policy.allowed)return json({error:"Bu hizmetler için erişim henüz açık değil."},403);
    return json({services:listLaunchServices(),state:"preview-only",productionEnabled:false});
  }catch{
    return json({error:"Hizmet kataloğu şu anda okunamadı."},503);
  }
}
