import {verifyPaymentAccessToken} from "../../../../lib/admin-auth";
import {getClientAccount} from "../../../../lib/repository";
import {createVerificationCode,sendVerificationEmail} from "../../../../lib/email-verification";

export async function POST(req){
  try{
    const body=await req.json();
    const access=await verifyPaymentAccessToken(body?.token||"");
    if(!access)return Response.json({error:"Bağlantı geçersiz veya süresi dolmuş."},{status:401});
    const account=await getClientAccount(access.clientId);
    if(!account||(account.payments||[]).every(x=>x.status!=="paid"))return Response.json({error:"Ödeme onayı gerekli."},{status:403});
    const v=await createVerificationCode(access.clientId,body?.email);
    await sendVerificationEmail(v.email,v.code);
    return Response.json({ok:true});
  }catch(e){
    const m=String(e?.message||"");
    if(m==="invalid-email")return Response.json({error:"Geçerli bir e-posta adresi girin."},{status:400});
    if(m==="email-provider-not-configured")return Response.json({error:"E-posta gönderimi henüz yapılandırılmadı."},{status:503});
    return Response.json({error:"Kod gönderilemedi."},{status:500});
  }
}
