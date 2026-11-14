import {freeMeasurementStatus,collectFreeAnswerEvidence} from '../../../lib/free-answer-evidence.mjs';
import {clientBaselineOptions} from '../../../lib/answer-evidence-baseline';
import {answerEvidenceStatus} from '../../../lib/answer-evidence-status';
import {repeatEvidenceOptions} from '../../../lib/answer-evidence-comparison';
import {requireAdmin,enforceSameOrigin} from '../../../lib/api-security';
import {getClient} from '../../../lib/repository';
import {getClientProfile} from '../../../lib/client-profile';
import {getProspect} from '../../../lib/prospects';
import {answerProviders} from '../../../lib/answer-evidence-providers';
import {evidenceQueries} from '../../../lib/answer-evidence-rules';
import {listAnswerEvidence,measureAnswerEvidence,getAnswerEvidenceRun} from '../../../lib/answer-evidence-store';
export const runtime='nodejs';
export const maxDuration=60;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function GET(req){const denied=await requireAdmin(req);if(denied)return denied;
 try{const params=new URL(req.url).searchParams,entityType=params.get('entityType'),entityId=params.get('entityId');if((entityType&&!['prospect','client'].includes(entityType))||(entityId&&!uuid(entityId)))return Response.json({error:'Geçersiz kayıt filtresi.'},{status:400});const [history,automation]=await Promise.allSettled([listAnswerEvidence({entityType,entityId}),answerEvidenceStatus({entityType,entityId})]);if(history.status!=='fulfilled')throw Error('history-unavailable');return Response.json({runs:history.value,status:automation.status==='fulfilled'?automation.value:{supported:true,error:'Otomatik ölçüm durumu alınamadı; bekleyen sayısı bilinmiyor.'},providers:answerProviders(),freeMeasurement:freeMeasurementStatus()},{headers:{'cache-control':'no-store'}})}catch{return Response.json({error:'Yanıt kanıtları alınamadı.'},{status:503})}}
export async function POST(req){const denied=await requireAdmin(req);if(denied)return denied;const origin=enforceSameOrigin(req);if(origin)return origin;
 try{
  const body=await req.json();if(!['prospect','client'].includes(body.entityType)||!uuid(body.entityId))return Response.json({error:'Geçerli bir işletme seçin.'},{status:400});
  if(body.baseline!==undefined&&(body.baseline!==true||body.entityType!=='client'||body.repeatRunId!==undefined))return Response.json({error:'Başlangıç ölçümü yalnız müşteri için yeni bir tur olabilir.'},{status:400});
  const row=body.entityType==='prospect'?await getProspect(body.entityId):await getClient(body.entityId);if(!row)return Response.json({error:'İşletme bulunamadı.'},{status:404});
  const profile=body.entityType==='client'?await getClientProfile(body.entityId):null,entity={...row,...(profile?{sector:profile.sector,city:profile.city,country:profile.country}:{}),entityType:body.entityType};
  if(body.freeOnly!==undefined&&typeof body.freeOnly!=='boolean')return Response.json({error:'Geçersiz ücretsiz ölçüm seçimi.'},{status:400});
  // Do not silently use the legacy paid-capable provider path. Explicit review-only opt-in.
  if(body.freeOnly!==true&&process.env.PAID_ANSWER_EVIDENCE_ENABLED!=='true')return Response.json({error:'Ücretli sağlayıcı ölçümü kapalı. Yalnız ücretsiz ölçüm seçimi kullanılabilir.'},{status:403,headers:{'cache-control':'no-store'}});
  if(body.freeOnly===true&&(body.baseline!==undefined||body.repeatRunId!==undefined))return Response.json({error:'Ücretsiz ölçüm yeni ve ayrı bir tur olmalıdır.'},{status:400});
  if(body.freeOnly===true&&!freeMeasurementStatus().ready)return Response.json({error:'Ücretsiz ölçüm bağlantısı hazır değil.',freeMeasurement:freeMeasurementStatus()},{status:503,headers:{'cache-control':'no-store'}});
  const language=body.language==='en'?'en':'tr';let queries;try{queries=body.repeatRunId!==undefined?[]:evidenceQueries(entity,body.queries??[],language).map(x=>x.query)}catch{return Response.json({error:'En fazla 2 sorgu yazın (8–500 karakter). Otomatik sorgu için sektör ve konum gerekli.'},{status:400})}
  let options={queries,language};
  if(body.baseline===true){try{options=clientBaselineOptions(entity,queries,language,answerProviders())}catch{return Response.json({error:'Başlangıç ölçümü için markayı/alan adını içermeyen tek sorgu ve bağlı sağlayıcı gerekir.'},{status:400})}}
  if(body.repeatRunId!==undefined){
   if(!uuid(body.repeatRunId)||body.queries!==undefined)return Response.json({error:'Tekrar ölçüm için yalnız kayıt kimliği gönderin.'},{status:400});
   const previous=await getAnswerEvidenceRun(body.repeatRunId);if(!previous)return Response.json({error:'Önceki ölçüm bulunamadı.'},{status:404});
   try{options=repeatEvidenceOptions(entity,previous,answerProviders())}catch{return Response.json({error:'İşletme kimliği veya sağlayıcı yapılandırması değişmiş; bu tur aynı koşullarda tekrarlanamıyor.'},{status:409})}
  }
  options.measurementOrigin='admin';
  const run=await measureAnswerEvidence(entity,options,body.freeOnly===true?{collect:collectFreeAnswerEvidence}:{});return Response.json({run},{status:run.skipped?409:200});
 }catch{return Response.json({error:'Yanıt kanıtı turu tamamlanamadı. Yapılandırmayı kontrol edip tekrar deneyin.'},{status:503})}}
