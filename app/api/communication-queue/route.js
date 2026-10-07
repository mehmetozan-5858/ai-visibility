import {permissionEnquiry,outreachSubject,outreachApproach} from "../../../lib/outreach-quality";
import {freeAssessmentUrl} from "../../../lib/free-assessment-token";
import {requireAdmin} from "../../../lib/api-security";
import {listCommunicationQueue} from "../../../lib/prospects";
export const runtime="nodejs";
export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{return Response.json({queue:(await listCommunicationQueue(150)).map(x=>({...x,outreachDraft:permissionEnquiry(x),outreachSubject:outreachSubject(x),outreachApproach:outreachApproach(x),freeAssessmentUrl:freeAssessmentUrl(x.id),outreachReason:"Sektöre uygun fayda odaklı ilk temas; ücretsiz ön değerlendirme ve ücretli rapor ayrımı."}))},{headers:{"cache-control":"no-store"}})}
  catch(e){return Response.json({error:String(e?.message||e)},{status:500})}
}
