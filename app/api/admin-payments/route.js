import {reversePayment} from "../../../lib/payment-reversal";
import {listPayments,confirmPayment,getPaymentById} from "../../../lib/repository";
import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{return Response.json({payments:await listPayments(150)})}
  catch(e){return Response.json({error:"Ödemeler okunamadı.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}
export async function PATCH(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const originError=enforceSameOrigin(req);if(originError)return originError;
  try{
    const body=await req.json();
    if(!body?.id)return Response.json({error:"Ödeme kaydı gerekli."},{status:400});
    if(body.action==="reverse"){
      const reason=String(body.reason||"").trim();
      if(reason.length<10||reason.length>1000)return Response.json({error:"Geri alma gerekçesi gerekli."},{status:400});
      return Response.json({payment:await reversePayment(body.id,reason)});
    }
    if(body.bankVerified!==true)return Response.json({error:"Banka tahsilatı doğrulanmalı."},{status:400});
    if(!body.bankEvidence||body.bankEvidence.confirmed!==true)return Response.json({error:"Banka kontrol formunu doldurup doğrulayın."},{status:400});
    const invoice=await getPaymentById(body.id);
    if(!invoice||!["TRY","EUR","USD","GBP"].includes(invoice.currency))return Response.json({error:"Geçerli para birimi gerekli; ödeme onaylanamaz."},{status:409});
    const payment=await confirmPayment(body.id,{bankEvidence:body.bankEvidence});
    if(!payment)return Response.json({error:"Ödeme onaylanamadı."},{status:409});
    return Response.json({payment});
  }catch(e){const messages={'bank-confirmation-required':'Yalnızca banka havalesi kaydı bu formdan onaylanabilir.','invalid-bank-amount':'Tutarı binlik ayırıcı olmadan yazın; örnek: 4990,00.','bank-currency-mismatch':'Para birimi ödeme kaydıyla eşleşmiyor.','bank-amount-mismatch':'Banka tutarı beklenen ödeme tutarıyla eşleşmiyor.','bank-invoice-mismatch':'Açıklama kodu bu ödeme kaydıyla eşleşmiyor.','invalid-bank-reference':'Bankanın işlem referansı gerekli; en az 6 karakter.','invalid-bank-date':'Geçerli bir tahsilat tarihi gerekli; ileri tarih kullanılamaz.','bank-reference-already-used':'Bu banka işlemi başka bir ödeme için kullanılmış.'};return Response.json({error:messages[e.message]||"Ödeme onaylanamadı; işlem kaydı korunarak geri alındı."},{status:messages[e.message]?409:500})}
}
