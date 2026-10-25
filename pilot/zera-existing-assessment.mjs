import {runLocalizedProviderChecks} from '../lib/localized-ai.js';
import {createPilot} from './zera-pilot.mjs';
/**
 * Bridges ZERA to the existing AI Visibility GEO/AEO assessment.
 * This is a business-data assessment, NOT direct observed ranking/citation evidence.
 * No provider calls without explicit enablement. Cost must be confirmed separately.
 */
export async function runZeraExistingAssessment({approved=false,invoke=runLocalizedProviderChecks}={}){
 if(!approved)throw new Error('Owner approval required for provider invocation');
 if(typeof invoke!=='function')throw new Error('Assessment provider unavailable');
 const p=createPilot();
 const prospect={name:p.brand,domain:'',sector:'women clothing boutique',
  city:p.city,country:'Germany',
  queries:['ZERA Clothing Wetzlar','Damenmode Boutique Wetzlar','Modest Fashion Wetzlar']};
 const output=await invoke(prospect,'en');
 const results=Array.isArray(output?.results)?output.results:[];
 return {
  pilotId:p.id,
  assessmentType:'model-generated-business-data-assessment',
  measuredSearchPresence:false,
  verifiedCitationCount:null,
  results:results.map(x=>({
   provider:String(x.provider||'unknown'),score:Number.isFinite(Number(x.score))?Number(x.score):null,
   summary:String(x.summary||''),findings:Array.isArray(x.findings)?x.findings:[],
   recommendations:Array.isArray(x.recommendations)?x.recommendations:[],
   provenance:'AI-generated analysis of supplied business profile; independently verify each claim'
  })),
  errors:Array.isArray(output?.errors)?output.errors:[],
  completed:results.length>0,
  warning:'These results do not establish search ranks, AI citations, tracked sales, or website performance.'
 };
}
