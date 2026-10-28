import {requireAdmin,enforceSameOrigin,checkRateLimit} from '../../../../lib/api-security';
import {findClientByIdentity} from '../../../../lib/repository';
import {createPaymentAccessToken} from '../../../../lib/admin-auth';

export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const origin=enforceSameOrigin(req);if(origin)return origin;
 const limited=checkRateLimit(req,{bucket:'zera-payment-link',limit:8,windowMs:15*60*1000});if(limited)return limited;
 try{
  const client=await findClientByIdentity('ZERA Clothing','');
  if(!client?.id||client.name!=='ZERA Clothing'||client.plan!=='Pilot')return Response.json({error:'ZERA pilot kaydı bulunamadı.'},{status:404});
  const token=await createPaymentAccessToken(client.id,3600,'business-diagnosis');
  return Response.json({paymentUrl:'/odeme?token='+encodeURIComponent(token)},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Ödeme bağlantısı hazırlanamadı.'},{status:500,headers:{'Cache-Control':'no-store'}})}
}
