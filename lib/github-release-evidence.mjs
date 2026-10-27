import {assessRelease} from './release-assurance.mjs';
const repository='mehmetozan-5858/ai-visibility';
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
async function readGithubJson(url,fetchImpl){
 const response=await fetchImpl(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(8000),
  headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'AIVisibilityReleaseAssurance'}});
 if(!response.ok)throw Error('github-source-http-'+response.status);
 if(response.redirected||!/json/i.test(response.headers.get('content-type')||''))throw Error('invalid-github-response');
 if(/rel="next"/.test(response.headers.get('link')||''))throw Error('github-evidence-truncated');
 const reader=response.body?.getReader();if(!reader)throw Error('missing-github-response');
 let bytes=0;const chunks=[];
 try{
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;
   if(bytes>524288){await reader.cancel();throw Error('github-evidence-too-large');}chunks.push(value);}
 }finally{reader.releaseLock();}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
/** Server-only public metadata collection. No credentials, writes or deploys.
 * Repository and required checks are fixed policy, never supplied by a client.
 */
export async function collectAiVisibilityRelease({targetSha,rollbackSha,fetchImpl=fetch}={}){
 if(!sha(targetSha)||!sha(rollbackSha)||targetSha===rollbackSha)throw Error('invalid-release-sha');
 const sourceUrl=`https://api.github.com/repos/${repository}/commits/${targetSha}/check-runs?per_page=100&filter=latest`;
 const rollbackUrl=`https://api.github.com/repos/${repository}/commits/${rollbackSha}`;
 const [data,rollback]=await Promise.all([readGithubJson(sourceUrl,fetchImpl),readGithubJson(rollbackUrl,fetchImpl)]);
 if(rollback?.sha!==rollbackSha)throw Error('rollback-source-mismatch');
 if(!Array.isArray(data?.check_runs)||!Number.isInteger(data.total_count)||data.total_count!==data.check_runs.length||data.check_runs.length>100)
  throw Error('incomplete-github-checks');
 const latest=new Map();
 for(const check of data.check_runs){
  // A successful lookalike check from a different app is not our CI evidence.
  if(check?.head_sha!==targetSha||check?.app?.id!==15368||check?.app?.slug!=='github-actions'||
     !Number.isSafeInteger(check.id)||check.id<=0)continue;
  if(!latest.has(check.name)||latest.get(check.name).id<check.id)latest.set(check.name,check);
 }
 const checks=[...latest.values()].map(c=>({id:c.id,name:c.name,head_sha:c.head_sha,status:c.status,conclusion:c.conclusion}));
 return {state:'github-evidence-collected',assessment:assessRelease({targetSha,rollbackSha,
  requiredChecks:['build','web-mobile-smoke'],checks}),checks,
  provenance:{repository,sourceUrl,rollbackUrl,capturedAt:new Date().toISOString()},deploymentAuthorized:false};
}
