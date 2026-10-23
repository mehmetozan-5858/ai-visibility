import {requireAdmin,enforceSameOrigin,checkRateLimit} from "../../../lib/api-security";
import {runFreeBridgeTask} from "../../../lib/ai-bridge-free-inference.mjs";

const noStore={"Cache-Control":"private, no-store, max-age=0"};
const respond=(data,status=200)=>Response.json(data,{status,headers:noStore});
const MODEL_ALLOWLIST=new Set([
  "cohere/north-mini-code:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
]);

/**
 * Admin-only explicit one-model trial. Disabled by default.
 * Does NOT register any inference tool in the external AI Bridge MCP.
 */
export async function POST(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const rate=checkRateLimit(req,{bucket:"ai-bridge-free-inference",limit:2,windowMs:60*60*1000});
  if(rate)return rate;
  if(process.env.AI_BRIDGE_INFERENCE_ENABLED!=="true")
    return respond({ok:false,reason:"inference-disabled"},503);
  if(!process.env.OPENROUTER_API_KEY)
    return respond({ok:false,reason:"missing-server-key"},503);
  let body;
  try{body=await req.json()}catch{return respond({ok:false,reason:"invalid-request"},400)}
  if(!body||typeof body!=="object"||!MODEL_ALLOWLIST.has(body.modelId))
    return respond({ok:false,reason:"model-not-allowlisted"},400);
  const result=await runFreeBridgeTask({
    enabled:true,modelId:body.modelId,prompt:body.prompt,
    apiKey:process.env.OPENROUTER_API_KEY,timeoutMs:10000,
  });
  return respond(result,result.ok?200:422);
}
