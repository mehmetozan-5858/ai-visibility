import {cookies} from "next/headers";
import {verifyClientToken} from "../../../lib/admin-auth";
import {getClientAccount} from "../../../lib/repository";

export async function GET(){
  try{
    const store=await cookies();
    const session=await verifyClientToken(store.get("ai_client")?.value||"");
    if(!session)return Response.json({error:"Müşteri oturumu geçersiz."},{status:401});
    const account=await getClientAccount(session.clientId);
    if(!account)return Response.json({error:"Müşteri hesabı bulunamadı."},{status:404});
    return Response.json({account});
  }catch{return Response.json({error:"Müşteri paneli yüklenemedi."},{status:500})}
}
