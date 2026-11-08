/** Pure acceptance gate for server-collected GitHub evidence, never a deployer. */
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
export function assessRelease({targetSha,rollbackSha,requiredChecks,checks}={}){
 if(!sha(targetSha)||!sha(rollbackSha)||targetSha===rollbackSha)throw Error('invalid-release-sha');
 if(!Array.isArray(requiredChecks)||!requiredChecks.length||requiredChecks.length>30||
    requiredChecks.some(x=>typeof x!=='string'||!x.trim()||x.length>128)||new Set(requiredChecks).size!==requiredChecks.length)
  throw Error('invalid-required-checks');
 if(!Array.isArray(checks)||checks.length>200)throw Error('invalid-check-evidence');
 const evidence=requiredChecks.map(name=>{
  const matching=checks.filter(c=>c&&c.name===name&&c.head_sha===targetSha);
  const check=matching[0];
  const passed=matching.length===1&&check.status==='completed'&&check.conclusion==='success'&&
   Number.isSafeInteger(check.id)&&check.id>0;
  return {name,passed,reason:!matching.length?'missing-exact-commit':matching.length!==1?'ambiguous-runs':passed?'passed':'not-successful',checkId:matching.length===1&&Number.isSafeInteger(check.id)?check.id:null};
 });
 return {targetSha,rollbackSha,state:evidence.every(c=>c.passed)?'checks-verified':'blocked',checks:evidence,
  deploymentAuthorized:false,requiresRuntimeAndCustomerAcceptance:true};
}
