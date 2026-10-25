import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {compareZeraProviders,ZERA_PROVIDERS} from '../../../../pilot/zera-three-providers.mjs';
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const invalidOrigin=enforceSameOrigin(req);if(invalidOrigin)return invalidOrigin;
 if(process.env.ZERA_GROUNDED_AI_ENABLED!=='true')return Response.json({error:'Provider spending is disabled'},{status:409});
 try{
  const body=await req.json();
  const providers=body?.providers??ZERA_PROVIDERS;
  const result=await compareZeraProviders({taskId:body?.taskId,providers,keys:{
   gemini:process.env.GEMINI_API_KEY,openai:process.env.OPENAI_API_KEY||process.env.AI_PROVIDER_API_KEY,
   perplexity:process.env.PERPLEXITY_API_KEY
  }});
  return Response.json({...result,stored:false});
 }catch(e){return Response.json({error:String(e?.message||'Provider comparison failed').slice(0,120)},{status:400})}
}
