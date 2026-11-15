/** Pure release ancestry decision; never accesses a provider or performs deployment. */
const SHA=/^[0-9a-f]{40}$/i;
export function releaseBaselineDecision({observedProductionSha,expectedProductionSha,candidateSha,productionIsAncestor=false}={}){
 for(const [field,value] of Object.entries({observedProductionSha,expectedProductionSha,candidateSha})){
  if(typeof value!=='string'||!SHA.test(value))return {ok:false,reason:'invalid-'+field};
 }
 if(observedProductionSha.toLowerCase()!==expectedProductionSha.toLowerCase())
  return {ok:false,reason:'production-moved-recheck-required'};
 if(candidateSha.toLowerCase()===observedProductionSha.toLowerCase())
  return {ok:false,reason:'candidate-equals-production-no-change'};
 if(productionIsAncestor!==true)
  return {ok:false,reason:'candidate-not-descended-from-production'};
 return {ok:true,reason:'ancestry-ok-not-release-approval'};
}
