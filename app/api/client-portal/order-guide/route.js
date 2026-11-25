import {cookies} from 'next/headers';
import {verifyClientToken} from '../../../../lib/admin-auth';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {exportOrderGuideDraftPdf} from '../../../../lib/order-guide-pdf.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const error=(status)=>Response.json({error:'Order guide unavailable'},{status,headers});

// Draft preview only. Off by default; no legacy paid status grants this feature.
export async function GET(req){
 if(process.env.ORDER_GUIDE_PREVIEW_ENABLED!=='true')return error(404);
 const formats=new URL(req.url).searchParams.getAll('format');
 const format=formats[0]??'pdf';
 if(formats.length>1||!['pdf','post','story'].includes(format))return error(400);
 try{
  const session=await verifyClientToken((await cookies()).get('ai_client')?.value||'');
  if(!session?.clientId)return error(401);
  const db=databasePool(getDatabaseUrl());
  const conn=await db.connect();
  let brand;
  try{
   await conn.query('BEGIN READ ONLY');
   const result=await conn.query(`SELECT c.name FROM clients c JOIN client_pilot_access p ON p.client_id=c.id
     WHERE c.id=$1 AND c.status='active' AND p.revoked_at IS NULL AND p.expires_at>NOW()`,[session.clientId]);
   brand=result.rows[0]?.name;
   await conn.query('COMMIT');
  }catch(e){await conn.query('ROLLBACK').catch(()=>{});throw e;}finally{conn.release();}
  if(!brand)return error(403);
  if(format!=='pdf'){
   const {exportOrderGuideSocialPng}=await import('../../../../lib/order-guide-social-png.mjs');
   const png=await exportOrderGuideSocialPng({brand},{format});
   return new Response(new Uint8Array(png),{headers:{...headers,'Content-Type':'image/png','Content-Disposition':`attachment; filename="instagram-${format}-entwurf.png"`}});
  }
  const pdf=await exportOrderGuideDraftPdf({brand});
  return new Response(new Uint8Array(pdf),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="bestellanleitung-entwurf.pdf"'}});
 }catch{return error(503);}
}
