import {evidenceQueries} from './answer-evidence-rules.js';

export function clientBaselineOptions(entity,queries=[],language='tr',providers=[]){
 if(entity.entityType!=='client')throw Error('client-baseline-required');
 const prepared=evidenceQueries(entity,queries,language);
 if(prepared.length!==1||prepared[0].brandPrompted)throw Error('single-neutral-query-required');
 const provider=providers.includes('Perplexity')?'Perplexity':providers[0];
 if(!provider)throw Error('provider-unavailable');
 return {queries:[prepared[0].query],providers:[provider],language,measurementPurpose:'implementation-baseline-candidate'};
}
