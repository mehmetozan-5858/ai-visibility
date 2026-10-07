import {addProspect,listProspects} from "../../../lib/prospects";
import {prospectEvidence} from "../../../lib/prospect-evidence";
import {evaluateOutreachPool} from "../../../lib/outreach-selection";
import {requireAdmin} from "../../../lib/api-security";
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 try{const rows=await listProspects(),review=evaluateOutreachPool(rows),ranked=new Map(review.ranked.map(x=>[x.id,x]));
  return Response.json({prospects:rows.map(x=>({...x,evidence:prospectEvidence(x),selectionPriority:ranked.get(x.id)?.selectionPriority??null,selectionReasons:ranked.get(x.id)?.selectionReasons||[],selectionReady:ranked.get(x.id)?.selectionReady||false})),review:{evaluated:review.evaluated,qualified:review.qualified,awaitingAnalysis:review.awaitingAnalysis}})
 }catch(e){return Response.json({error:"Adaylar okunamadı."},{status:503})}
}
export async function POST(req){try{const b=await req.json();if(!b?.name?.trim())return Response.json({error:"İşletme adı zorunlu."},{status:400});const p=await addProspect({name:b.name.trim(),domain:(b.domain||"").trim(),sector:(b.sector||"").trim(),city:(b.city||"").trim(),source:(b.source||"manual").trim()});return Response.json({prospect:p},{status:201})}catch(e){return Response.json({error:"Aday kaydedilemedi."},{status:500})}}
