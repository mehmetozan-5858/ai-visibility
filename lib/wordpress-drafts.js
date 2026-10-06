import crypto from 'node:crypto';
import {wordpressTarget,draftContent,wordpressObservation} from "./wordpress-validation";
import {databasePool,initializeSchema} from './database-runtime';
import {getDatabaseUrl} from './db';
import {budgetFetch} from './request-budget';
import {lookup} from 'node:dns/promises';
import {BlockList} from 'node:net';
async function safePublicHost(hostname){
 const blocked=new BlockList();for(const [ip,bits,type] of [['0.0.0.0',8,'ipv4'],['10.0.0.0',8,'ipv4'],['127.0.0.0',8,'ipv4'],['169.254.0.0',16,'ipv4'],['172.16.0.0',12,'ipv4'],['192.168.0.0',16,'ipv4'],['100.64.0.0',10,'ipv4'],['224.0.0.0',4,'ipv4'],['::',128,'ipv6'],['::1',128,'ipv6'],['fc00::',7,'ipv6'],['fe80::',10,'ipv6'],['::ffff:0:0',96,'ipv6']])blocked.addSubnet(ip,bits,type);
 const addresses=await lookup(hostname,{all:true});if(!addresses.length||addresses.some(x=>blocked.check(x.address,x.family===6?'ipv6':'ipv4')))throw new Error('private-wordpress-host');
}
async function cmsPool(){
 const url=getDatabaseUrl();if(!url)throw new Error('database-not-configured');const pool=databasePool(url);
 await initializeSchema(pool,'cms-deliveries',async tx=>tx.query(`CREATE TABLE IF NOT EXISTS cms_deliveries(
  work_id UUID PRIMARY KEY REFERENCES work_items(id) ON DELETE CASCADE,status TEXT NOT NULL,post_id BIGINT,
  edit_url TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 )`));return pool;
}
export async function listCmsDeliveries(){const pool=await cmsPool();return (await pool.query('SELECT work_id AS "workId",status,post_id AS "postId",edit_url AS "editUrl" FROM cms_deliveries ORDER BY updated_at DESC LIMIT 150')).rows}
export async function createWordpressDraft(workId){
 if(!process.env.WORDPRESS_SITE_URL||!process.env.WORDPRESS_USERNAME||!process.env.WORDPRESS_APPLICATION_PASSWORD)throw new Error('cms-not-configured');
 const pool=await cmsPool(),tx=await pool.connect();let site,post;
 try{
  await tx.query('BEGIN');
  const work=(await tx.query(`SELECT w.*,c.domain FROM work_items w JOIN clients c ON c.id=w.client_id WHERE w.id=$1 FOR UPDATE OF w`,[workId])).rows[0];
  if(!work||work.source!=='implementation-agent'||!['ready','in-progress'].includes(work.status))throw new Error('work-not-ready');
  if(!/content|içerik|icerik|faq|soru|location|lokasyon/i.test(work.title))throw new Error('content-task-required');
  if(!(await tx.query(`SELECT 1 FROM payments WHERE client_id=$1 AND status='paid' LIMIT 1`,[work.client_id])).rows[0])throw new Error('paid-service-required');
  site=wordpressTarget(process.env.WORDPRESS_SITE_URL,work.domain);
  const existing=(await tx.query('SELECT * FROM cms_deliveries WHERE work_id=$1',[workId])).rows[0];
  if(existing){await tx.query('COMMIT');return {status:existing.status,postId:existing.post_id,editUrl:existing.edit_url,duplicate:true}}
  const draft=draftContent(work.title,work.detail);
  await safePublicHost(new URL(site).hostname);
  const headers={authorization:'Basic '+Buffer.from(process.env.WORDPRESS_USERNAME+':'+process.env.WORDPRESS_APPLICATION_PASSWORD).toString('base64'),'content-type':'application/json'};
  await tx.query("INSERT INTO cms_deliveries(work_id,status) VALUES($1,'delivery-unknown')",[workId]);
  // The durable unknown state prevents duplicate draft creation after a timeout or crash.
  await tx.query('COMMIT');
  try{
   const res=await budgetFetch(site+'/wp-json/wp/v2/posts',{method:'POST',headers,redirect:'error',body:JSON.stringify({...draft,slug:'aiv-'+workId})});
   if(!res.ok)throw new Error('wordpress-http-'+res.status);
   post=await res.json();if(!Number.isSafeInteger(post.id)||post.status!=='draft')throw new Error('invalid-draft-response');
  }catch(e){if(String(e.message).startsWith('wordpress-http-'))await pool.query("UPDATE cms_deliveries SET status='delivery-failed',updated_at=NOW() WHERE work_id=$1",[workId]);throw e}
  const editUrl=site+'/wp-admin/post.php?post='+post.id+'&action=edit';
  await pool.query("UPDATE cms_deliveries SET status='draft-created',post_id=$2,edit_url=$3,updated_at=NOW() WHERE work_id=$1",[workId,post.id,editUrl]);
  await pool.query("UPDATE work_items SET status='in-progress',updated_at=NOW() WHERE id=$1",[workId]);
  return {status:'draft-created',postId:post.id,editUrl,published:false};
 }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e}finally{tx.release()}
}

export async function reconcileWordpressDelivery(workId){
 if(!process.env.WORDPRESS_SITE_URL||!process.env.WORDPRESS_USERNAME||!process.env.WORDPRESS_APPLICATION_PASSWORD)throw Error('cms-not-configured');
 const pool=await cmsPool(),tx=await pool.connect();
 try{
  await tx.query('BEGIN');
  const work=(await tx.query(`SELECT w.*,c.domain FROM work_items w JOIN clients c ON c.id=w.client_id WHERE w.id=$1 FOR UPDATE OF w`,[workId])).rows[0];
  if(!work||work.source!=='implementation-agent')throw Error('work-not-ready');
  const delivery=(await tx.query('SELECT * FROM cms_deliveries WHERE work_id=$1 FOR UPDATE',[workId])).rows[0];
  if(!delivery)throw Error('delivery-not-found');
  const site=wordpressTarget(process.env.WORDPRESS_SITE_URL,work.domain);
  await safePublicHost(new URL(site).hostname);
  const query=new URLSearchParams({context:'edit',_fields:'id,type,slug,status'});
  if(!delivery.post_id){query.set('slug','aiv-'+workId);query.set('status','draft,publish,pending,private,future');query.set('per_page','2')}
  const res=await budgetFetch(site+'/wp-json/wp/v2/posts'+(delivery.post_id?'/'+encodeURIComponent(delivery.post_id):'')+'?'+query,{method:'GET',headers:{authorization:'Basic '+Buffer.from(process.env.WORDPRESS_USERNAME+':'+process.env.WORDPRESS_APPLICATION_PASSWORD).toString('base64')},redirect:'error'});
  if(!res.ok)throw Error('wordpress-http-'+res.status);
  const observed=wordpressObservation(await res.json(),workId,delivery.post_id);
  if(!observed){await tx.query('COMMIT');return {status:'not-found-review-required',duplicateCreationAllowed:false}}
  const editUrl=site+'/wp-admin/post.php?post='+observed.postId+'&action=edit';
  await tx.query('UPDATE cms_deliveries SET status=$2,post_id=$3,edit_url=$4,updated_at=NOW() WHERE work_id=$1',[workId,observed.status,observed.postId,editUrl]);
  if(delivery.status!==observed.status||Number(delivery.post_id)!==observed.postId)await tx.query(`INSERT INTO client_activity(id,client_id,event_type,title,detail,metadata) VALUES($1,$2,'cms-delivery','WordPress teslim durumu kontrol edildi',$3,$4::jsonb)`,[crypto.randomUUID(),work.client_id,'WordPress kaydı okunarak teslim eşleştirildi. Görev tamamlanma durumu değiştirilmedi.',JSON.stringify({workId,postId:observed.postId,status:observed.status,previousStatus:delivery.status})]);
  await tx.query('COMMIT');return {...observed,editUrl,workCompleted:false};
 }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e}finally{tx.release()}
}
