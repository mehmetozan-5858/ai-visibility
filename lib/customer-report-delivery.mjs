import {createHash} from 'node:crypto';
/** Recipient comes exclusively from the customer's credential plus verified mailbox history. */
export async function reportRecipient(pool,clientId){
 const tables=await pool.query("SELECT to_regclass('public.client_credentials') AS credentials,to_regclass('public.client_email_verifications') AS verifications");
 if(!tables.rows[0]?.credentials||!tables.rows[0]?.verifications)return null;
 const rows=await pool.query(`SELECT c.email FROM public.client_credentials c WHERE c.client_id=$1
  AND EXISTS(SELECT 1 FROM public.client_email_verifications v WHERE v.client_id=c.client_id
   AND lower(v.email)=lower(c.email) AND v.verified_at IS NOT NULL) LIMIT 2`,[clientId]);
 if(rows.rows.length!==1)return null;
 const email=String(rows.rows[0].email||'').trim().toLowerCase();
 return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)?email:null;
}
export function customerReportDeliveryKey({clientId,email,report}){
 return 'customer-report:'+createHash('sha256').update(JSON.stringify({clientId,email,report})).digest('hex');
}
/** Explicit customer action, no scheduler or arbitrary recipient input. Provider acceptance is not inbox delivery. */
export function createCustomerReportEmailHandler({authorize,guard,getAccount,getAccess,getPool,getRecipient,readComparisons,buildReport,deliver,settings}){
 const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'};
 const json=(body,status=200)=>Response.json(body,{status,headers});
 return async function POST(req){
  const rejected=await guard(req);if(rejected)return rejected;
  const session=await authorize();if(!session)return json({error:'Müşteri oturumu gerekli.'},401);
  let body;try{body=await req.json()}catch{return json({error:'Geçersiz istek.'},400)}
  if(body?.confirmSendReport!==true||Object.keys(body).length!==1)return json({error:'Rapor gönderimi onayı gerekli.'},400);
  try{
   const account=await getAccount(session.clientId);if(!account)return json({error:'Müşteri bulunamadı.'},404);
   const access=await getAccess(account);if(!access.allowed)return json({error:'Aktif müşteri veya pilot erişimi gerekli.'},403);
   const env=settings();if(!env.RESEND_API_KEY||!env.RESEND_FROM_EMAIL)return json({error:'Rapor e-posta servisi hazır değil.'},503);
   const pool=getPool(),email=await getRecipient(pool,session.clientId);
   if(!email||(access.kind==='pilot'&&String(access.email||'').toLowerCase()!==email))return json({error:'Doğrulanmış hesap e-postası gerekli.'},409);
   const scans=(account.scans||[]).filter(s=>s.status==='completed'&&s.score!=null&&Number.isFinite(Number(s.score)));
   const comparisons=scans.length?[]:await readComparisons(pool,session.clientId);
   if(!scans.length&&!comparisons.length)return json({error:'Gönderilebilir rapor henüz yok.'},409);
   const report={clientId:session.clientId,clients:[account.client],allScans:scans.map(s=>({...s,clientId:session.clientId})),comparisons,pilot:access.kind==='pilot'};
   const response=await buildReport(report),content=Buffer.from(await response.arrayBuffer()).toString('base64');
   const key=customerReportDeliveryKey({clientId:session.clientId,email,report});
   const sent=await deliver(key,{from:env.RESEND_FROM_EMAIL,to:[email],subject:'AI Visibility Works - raporunuz',text:'Raporunuz ektedir. Kayıtlı AI yanıtları görünürlük skoru veya sıralama ölçümü olarak değerlendirilmemelidir.',attachments:[{filename:'ai-visibility-report.pdf',content}]},async()=>{});
   return json({ok:true,status:'provider-accepted',duplicate:sent.duplicate===true,message:'Rapor e-posta sağlayıcısına iletildi; gelen kutusuna teslim henüz doğrulanmadı.'});
  }catch{return json({error:'Rapor gönderimi tamamlanamadı; tekrar denemeden önce gönderim durumunu kontrol edin.'},503)}
 };
}
