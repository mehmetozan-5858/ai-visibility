import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {PDFDocument} from 'pdf-lib';
import sharp from 'sharp';
import {createClientToken,verifyClientToken} from '../lib/admin-auth.js';
import {orderGuideAllowed} from '../lib/order-guide-access.mjs';
import {exportOrderGuideDraftPdf} from '../lib/order-guide-pdf.mjs';
import {exportOrderGuideSocialPng} from '../lib/order-guide-social-png.mjs';

test('isolated signed pilot download route returns real PDF and PNG bytes only for active allowed tenant',async()=>{
 const own='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const settings={AUTH_SECRET:'isolated-order-guide-test-only',ORDER_GUIDE_PREVIEW_ENABLED:'true',ORDER_GUIDE_PREVIEW_CLIENT_ID:own};
 const previous=Object.fromEntries(Object.keys(settings).map(k=>[k,process.env[k]]));
 Object.assign(process.env,settings);
 const db=new PGlite();
 try{
  await db.exec("CREATE TABLE clients(id UUID PRIMARY KEY,name TEXT,status TEXT); CREATE TABLE client_pilot_access(client_id UUID PRIMARY KEY REFERENCES clients(id),expires_at TIMESTAMPTZ,revoked_at TIMESTAMPTZ)");
  await db.query("INSERT INTO clients VALUES($1,'Fixture A','active'),($2,'Fixture B','active')",[own,other]);
  await db.query("INSERT INTO client_pilot_access VALUES($1,NOW()+INTERVAL '1 day',NULL),($2,NOW()+INTERVAL '1 day',NULL)",[own,other]);
  let token=await createClientToken(own),reads=0;
  const source=(await readFile(new URL('../app/api/client-portal/order-guide/route.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/^export /gm,'').replace("const {exportOrderGuideSocialPng}=await import('../../../../lib/order-guide-social-png.mjs');",'');
  const pool=()=>({connect:async()=>({query:async(sql,args)=>{if(args){reads++;assert.deepEqual(args,[own]);}return db.query(sql,args)},release(){}})});
  const get=new Function('orderGuideAllowed','cookies','verifyClientToken','databasePool','getDatabaseUrl','exportOrderGuideDraftPdf','exportOrderGuideSocialPng',source+';return GET')(orderGuideAllowed,async()=>({get:()=>({value:token})}),verifyClientToken,pool,()=> 'fixture',exportOrderGuideDraftPdf,exportOrderGuideSocialPng);
  const fetchFormat=format=>get(new Request('https://example.test/api/client-portal/order-guide?format='+format));
  for(const [format,height] of [['pdf',0],['post',1350],['story',1920]]){
   const response=await fetchFormat(format);assert.equal(response.status,200);
   assert.match(response.headers.get('cache-control'),/private.*no-store/);
   assert.match(response.headers.get('content-disposition'),/^attachment/);
   const bytes=Buffer.from(await response.arrayBuffer());
   if(format==='pdf'){assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);}
   else{assert.equal(response.headers.get('content-type'),'image/png');const m=await sharp(bytes).metadata();assert.equal(m.format,'png');assert.equal(m.width,1080);assert.equal(m.height,height);}
  }
  assert.equal(reads,3);
  token=await createClientToken(other);assert.equal((await fetchFormat('pdf')).status,403);assert.equal(reads,3);
  token='invalid';assert.equal((await fetchFormat('story')).status,401);assert.equal(reads,3);
  token=await createClientToken(own);
  await db.query('UPDATE client_pilot_access SET revoked_at=NOW() WHERE client_id=$1',[own]);
  assert.equal((await fetchFormat('post')).status,403);
  await db.query("UPDATE client_pilot_access SET revoked_at=NULL,expires_at=NOW()-INTERVAL '1 day' WHERE client_id=$1",[own]);
  assert.equal((await fetchFormat('pdf')).status,403);
  await db.query("UPDATE client_pilot_access SET expires_at=NOW()+INTERVAL '1 day' WHERE client_id=$1",[own]);
  await db.query("UPDATE clients SET status='payment-review' WHERE id=$1",[own]);
  assert.equal((await fetchFormat('story')).status,403);
  process.env.ORDER_GUIDE_PREVIEW_ENABLED='false';assert.equal((await fetchFormat('pdf')).status,404);
 }finally{await db.close();for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
});
