import {runPublicPilotAudit} from './zera-runner.mjs';
import {createPilot} from './zera-pilot.mjs';
/**
 * Adapter contract for an existing, configured provider service.
 * Never sends network requests; consumers must inject a reviewed read-only provider.
 */
export function createVerifiedPublicProviderAdapter({search,allowedChannels=['google','ai-answer']}={}){
 if(typeof search!=='function')throw new TypeError('A configured search provider is required');
 return async task=>{
  if(!allowedChannels.includes(task.channel))throw new Error('Channel unavailable');
  if(!['de-DE','tr-TR'].includes(task.locale))throw new Error('Unsupported locale');
  const response=await search({query:task.query,locale:task.locale,channel:task.channel});
  // Reject metadata-only results, invented snippets, and undated results.
  if(!response?.sourceUrl||!response?.observedAt||!response?.observation)throw new Error('Provider evidence insufficient');
  const url=new URL(response.sourceUrl);
  if(url.protocol!=='https:')throw new Error('HTTPS source required');
  if(!Number.isFinite(Date.parse(response.observedAt)))throw new Error('Evidence timestamp invalid');
  return {taskId:task.id,evidence:{type:'observed',sourceUrl:url.href,observedAt:response.observedAt,
   query:task.query,observation:response.observation}};
 };
}
export async function executeZeraPilotWithProvider({search,approved=false,maxTasks=7}={}){
 // Requires owner approval and configured provider. Does not mutate live tenancy.
 return runPublicPilotAudit({pilot:createPilot(),executor:createVerifiedPublicProviderAdapter({search}),approved,maxTasks});
}
