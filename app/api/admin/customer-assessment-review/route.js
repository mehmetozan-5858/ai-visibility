import {requireAdmin,checkRateLimit} from "../../../../lib/api-security";
import {databasePool} from "../../../../lib/database-runtime";
import {getDatabaseUrl} from "../../../../lib/db";
import {findAssessmentCandidates} from "../../../../lib/customer-assessment-candidates.mjs";

const headers={"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","Vary":"Cookie"};
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const limit=checkRateLimit(req,{bucket:"customer-assessment-review",limit:20,windowMs:15*60*1000});if(limit)return limit;
 try{
  const db=getDatabaseUrl();if(!db)return Response.json({error:"Database unavailable"},{status:503,headers});
  const pool=databasePool(db);
  const [leads,prospects]=await Promise.all([
   pool.query("SELECT id,status,website FROM public.customer_leads ORDER BY created_at DESC LIMIT 200"),
   pool.query("SELECT id,domain FROM public.prospects ORDER BY created_at DESC LIMIT 5000")
  ]);
  const review=findAssessmentCandidates(leads.rows,prospects.rows);
  return Response.json({review,reviewOnly:true,verifiedOwnership:false,tokenIssued:false,analysisStarted:false},{headers});
 }catch{
  return Response.json({error:"Assessment candidates unavailable"},{status:503,headers});
 }
}
