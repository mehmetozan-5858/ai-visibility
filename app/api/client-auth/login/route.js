import {verifyClientCredential} from "../../../../lib/client-credentials";
import {createClientToken} from "../../../../lib/admin-auth";

export async function POST(req){
  try{
    const body=await req.json();
    const credential=await verifyClientCredential(body?.email||"",body?.password||"");
    if(!credential)return Response.json({error:"E-posta veya şifre hatalı."},{status:401});
    const session=await createClientToken(credential.clientId);
    const res=Response.json({ok:true});
    res.headers.append("Set-Cookie",`ai_client=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
    return res;
  }catch{return Response.json({error:"Müşteri girişi yapılamadı."},{status:500})}
}
export async function DELETE(){
  const res=Response.json({ok:true});
  res.headers.append("Set-Cookie","ai_client=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  return res;
}
