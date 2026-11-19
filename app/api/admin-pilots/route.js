import {getClientCredential,getClientCredentialByEmail} from "../../../lib/client-credentials";
import {requireAdmin,enforceSameOrigin} from '../../../lib/api-security';
import {getClientAccount,listClients} from '../../../lib/repository';
import {getPilotAccess,grantPilot,revokePilot} from '../../../lib/pilot-access';
import {createPaymentAccessToken} from '../../../lib/admin-auth';

// REVIEW BRANCH ONLY. The explicit ZERA bootstrap is administrator-initiated;
// the invited owner must independently verify their email and set their own
// password via the existing /odeme pilot activation flow. No password, code,
// or email is embedded in source, and no paid checkout is required.
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 try{
  const clients=await listClients();
  return Response.json({clients:await Promise.all(clients.map(async x=>({
   id:x.id,name:x.name,pilot:await getPilotAccess(x.id)
  })))});
 }catch{return Response.json({error:'Pilot listesi yüklenemedi.'},{status:500})}
}

export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const origin=enforceSameOrigin(req);if(origin)return origin;
 try{
  const b=await req.json(),account=await getClientAccount(b.clientId);
  if(!account)return Response.json({error:'Müşteri bulunamadı.'},{status:404});
  if(b.action==='revoke'){
   await revokePilot(b.clientId);
   return Response.json({ok:true});
  }
  if(b.action!=='grant'&&b.action!=='bootstrap')
   return Response.json({error:'Desteklenmeyen pilot işlemi.'},{status:400});
  const email=String(b.email||'').trim().toLowerCase();
  const credential=await getClientCredential(b.clientId);
  if(b.action==='bootstrap'){
   // Never apply the no-credential exception to another customer or a
   // suspended account, and never replace an existing credential or grant.
   const c=account.client;
   if(c?.name!=='ZERA Clothing'||c?.plan!=='Pilot'||c?.status!=='active'||
      b.confirmZeraPilotBootstrap!==true||credential)
    return Response.json({error:'ZERA ilk hesap daveti koşulları sağlanmadı.'},{status:409});
   if(await getPilotAccess(b.clientId))
    return Response.json({error:'Pilot daveti zaten etkin; yeniden başlatmayın.'},{status:409});
   // Existing credential emails are globally unique. An address already
   // linked to ANY other tenant cannot be assigned to ZERA: do not create
   // a pilot that the user cannot finish or disclose the other tenant.
   if(await getClientCredentialByEmail(email))
    return Response.json({error:'Bu e-posta zaten başka bir müşteri giriş hesabına bağlı; ZERA için farklı bir doğrulanabilir adres kullanın.'},{status:409});
   // Existing email-verification route uses Resend exclusively. Refuse to
   // grant a first-login pilot when the invitation recipient cannot receive
   // a code. This is presence-only, NOT delivery, free-quota or email proof.
   if(!process.env.RESEND_API_KEY||
      !(process.env.EMAIL_FROM||process.env.RESEND_FROM_EMAIL))
    return Response.json({error:'E-posta doğrulama gönderimi yapılandırılmadı; ZERA daveti açılmadı.'},{status:503});
  }else{
   if(!credential)
    return Response.json({error:'Pilot hesabında doğrulanmış giriş kaydı yok; önce güvenli müşteri girişini hazırlayın.'},{status:409});
   if(credential.email.toLowerCase()!==email)
    return Response.json({error:'Pilot e-postası mevcut müşteri hesabıyla eşleşmeli.'},{status:409});
  }
  // The invitation HMAC key must exist BEFORE any entitlement write.
  // Without it a pilot could be granted with no usable signed link.
  if(!process.env.AUTH_SECRET)
   return Response.json({error:'Güvenli davet imzası yapılandırılmadı; pilot erişimi açılmadı.'},{status:503});
  await grantPilot(b.clientId,email,Number(b.days),String(b.reason||'').trim(),{onlyIfInactive:b.action==='bootstrap'});
  const token=await createPaymentAccessToken(
   b.clientId,Math.min(Number(b.days)*86400,604800),'pilot-diagnosis');
  return Response.json({ok:true,pilotUrl:'/odeme?token='+encodeURIComponent(token),
   testOnly:b.action==='bootstrap'});
 }catch(error){
  if(error?.message==='pilot-already-active')
   return Response.json({error:'Pilot daveti zaten etkin; yeniden başlatmayın.'},{status:409});
  return Response.json({error:'Pilot açılamadı. E-posta, 1–30 gün süre ve gerekçe gereklidir.'},{status:400})}
}
