import {verifyClientCredential} from "../../../../lib/client-credentials";
import {createClientToken} from "../../../../lib/admin-auth";
import {checkRateLimit,clearRateLimit,enforceSameOrigin} from "../../../../lib/api-security";
import {resolveRequestLanguage} from "../../../../lib/localized-ai";

export async function POST(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"client-login",limit:8,windowMs:15*60*1000});if(limited)return limited;
  let language="tr";
  try{
    const body=await req.json();language=resolveRequestLanguage(req,body);const en=language==="en";
    const credential=await verifyClientCredential(body?.email||"",body?.password||"");
    if(!credential)return Response.json({error:en?"Incorrect email or password.":"E-posta veya şifre hatalı."},{status:401});
    clearRateLimit(req,"client-login");
    const session=await createClientToken(credential.clientId);
    const res=Response.json({ok:true,language});
    res.headers.append("Set-Cookie",`ai_client=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
    return res;
  }catch{return Response.json({error:language==="en"?"Customer sign-in failed.":"Müşteri girişi yapılamadı."},{status:500})}
}
export async function DELETE(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const res=Response.json({ok:true});
  res.headers.append("Set-Cookie","ai_client=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  return res;
}
