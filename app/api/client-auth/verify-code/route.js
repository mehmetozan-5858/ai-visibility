import {verifyPaymentAccessToken} from "../../../../lib/admin-auth";
import {verifyEmailCode} from "../../../../lib/email-verification";

export async function POST(req){
  try{
    const body=await req.json();
    const access=await verifyPaymentAccessToken(body?.token||"");
    if(!access)return Response.json({error:"Bağlantı geçersiz veya süresi dolmuş."},{status:401});
    const verified=await verifyEmailCode(access.clientId,body?.email,body?.code);
    if(!verified)return Response.json({error:"Kod hatalı veya süresi dolmuş."},{status:400});
    return Response.json({ok:true,email:verified.email});
  }catch{
    return Response.json({error:"Kod doğrulanamadı."},{status:500});
  }
}
