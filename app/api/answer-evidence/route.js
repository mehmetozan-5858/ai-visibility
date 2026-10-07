import {requireAdmin,enforceSameOrigin} from '../../../lib/api-security';
import {getClient} from '../../../lib/repository';
import {getClientProfile} from '../../../lib/client-profile';
import {getProspect} from '../../../lib/prospects';
import {answerProviders} from '../../../lib/answer-evidence-providers';
import {evidenceQueries} from '../../../lib/answer-evidence-rules';
import {listAnswerEvidence,measureAnswerEvidence} from '../../../lib/answer-evidence-store';
export const runtime='nodejs';
export const maxDuration=60;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function GET(req){const denied=await requireAdmin(req);if(denied)return denied;
 try{const params=new URL(req.url).searchParams,entityType=params.get('entityType'),entityId=params.get('entityId');if((entityType&&!['prospect','client'].includes(entityType))||(entityId&&!uuid(entityId)))return Response.json({error:'Geçersiz kayıt filtresi.'},{status:400});return Response.json({runs:await listAnswerEvidence({entityType,entityId}),providers:answerProviders()},{headers:{'cache-control':'no-store'}})}catch{return Response.json({error:'Yanıt kanıtları alınamadı.'},{status:503})}}
export async function POST(req){const denied=await requireAdmin(req);if(denied)return denied;const origin=enforceSameOrigin(req);if(origin)return origin;
 try{
  const body=await req.json();if(!['prospect','client'].includes(body.entityType)||!uuid(body.entityId))return Response.json({error:'Geçerli bir işletme seçin.'},{status:400});
  const row=body.entityType==='prospect'?await getProspect(body.entityId):await getClient(body.entityId);if(!row)return Response.json({error:'İşletme bulunamadı.'},{status:404});
  const profile=body.entityType==='client'?await getClientProfile(body.entityId):null,entity={...row,...(profile?{sector:profile.sector,city:profile.city,country:profile.country}:{}),entityType:body.entityType};
  const language=body.language==='en'?'en':'tr';let queries;try{queries=evidenceQueries(entity,body.queries??[],language).map(x=>x.query)}catch{return Response.json({error:'En fazla 2 sorgu yazın (8–500 karakter). Otomatik sorgu için sektör ve konum gerekli.'},{status:400})}
  const run=await measureAnswerEvidence(entity,{queries,language});return Response.json({run},{status:run.skipped?409:200});
 }catch{return Response.json({error:'Yanıt kanıtı turu tamamlanamadı. Yapılandırmayı kontrol edip tekrar deneyin.'},{status:503})}}
