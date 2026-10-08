import {requireAdmin,enforceSameOrigin} from '../../../lib/api-security';
import {listOutreachEvaluationCandidates,getCommunicationProspect,saveSourceReview} from '../../../lib/prospects';
import {evaluateOutreachPool} from '../../../lib/outreach-selection';
import {reviewInput,verifySourceReview} from '../../../lib/source-review';
export const runtime='nodejs';export const maxDuration=90;
const headers={'cache-control':'no-store'};
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const rows=evaluateOutreachPool(await listOutreachEvaluationCandidates()).ranked;
 const offset=Math.max(0,Math.min(10000,Number(new URL(req.url).searchParams.get('offset'))||0));
 return Response.json({format:'prospect-source-review-v1',total:rows.length,offset,nextOffset:offset+10<rows.length?offset+10:null,candidates:rows.slice(offset,offset+10).map(x=>({id:x.id,name:x.name,domain:x.domain,sector:x.sector,country:x.country,city:x.city,source:x.source,sourceReview:x.sourceReview,inspection:x.enquiryEvidence?.inspection||x.scanEvidence,providerAssessment:x.scanProvider?{provider:x.scanProvider,findings:x.scanFindings,recommendations:x.scanRecommendations}:null})),importExample:{reviews:[{id:rows[offset]?.id||'',facts:[{sourceUrl:'https://official-domain/contact',excerpt:'Resmî sayfadan aynen alınan en az 20 karakterlik metin'}]}]}},{headers});
}
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;const origin=enforceSameOrigin(req);if(origin)return origin;
 if(Number(req.headers.get('content-length'))>50000)return Response.json({error:'Dosya çok büyük.'},{status:413,headers});
 let rows;try{const raw=await req.text();if(raw.length>50000)throw Error();rows=reviewInput(JSON.parse(raw))}catch{return Response.json({error:'En fazla 10 aday, aday başına 5 kaynaklı alıntı yükleyin. Puan aktarılmaz.'},{status:400,headers})}
 const results=[],start=Date.now();
 for(const x of rows){if(Date.now()-start>55000){results.push({id:x.id,status:'deferred'});continue}try{const p=await getCommunicationProspect(x.id);if(!p)throw Error();const review=await verifySourceReview(x,p);if(!await saveSourceReview(x.id,review))throw Error();results.push({id:x.id,status:'saved',facts:review.facts.length})}catch{results.push({id:x.id,status:'not-verified'})}}
 return Response.json({results,sent:0,aiCalls:0},{headers});
}
