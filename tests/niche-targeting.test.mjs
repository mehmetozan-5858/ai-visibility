import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NICHE_SECTORS,nicheFit,nicheSearchSector} from '../lib/niche-targeting.js';
test('focused rotation covers every example and retains broad discovery',()=>{
 const themes=new Set();let focused=0;
 for(let slot=0;slot<40;slot++){if(nicheSearchSector(slot))focused++;for(let i=0;i<3;i++)if(nicheSearchSector(slot,i))themes.add(nicheSearchSector(slot,i))}
 assert.equal(focused,32);assert.equal(themes.size,NICHE_SECTORS.length);
 assert.equal(nicheFit('Turizm / Otel'),false);assert.equal(nicheFit('Calibration laboratory'),true);
 assert.equal(nicheFit('Specialist acoustics','specialist-evidence: Architectural acoustic testing for studio builders'),true);
});
const raw=await readFile(new URL('../lib/providers.js',import.meta.url),'utf8');
const discovery=raw.slice(raw.indexOf('export async function discoverBusinesses'),raw.indexOf('export async function runSalesOffer')).replace('export ','');
const row=(name,extras={})=>({name,domain:'specialist.example.org',sector:'Architectural acoustics',city:'London',country:'United Kingdom',...extras});
test('specialist hunt accepts evidence-backed niches outside the examples and rejects filler',async()=>{
 let prompt='';
 const fetch=async(url,options)=>{prompt=JSON.parse(options.body).input;return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({businesses:[row('Acoustics',{sourceUrl:'https://specialist.example.org/services',specialistEvidence:'Acoustic design and measurement for recording studio builders'}),row('Filler'),row('Wrong source',{sourceUrl:'https://directory.org/company',specialistEvidence:'Acoustic design and measurement for recording studio builders'})]})}]}]})};
 const discover=new Function('fetch','parseJson','NICHE_SECTORS','process',discovery+';return discoverBusinesses;')(fetch,JSON.parse,NICHE_SECTORS,{env:{PERPLEXITY_API_KEY:'fixture'}});
 const results=await discover({city:'London',country:'United Kingdom',nicheFocus:true,focusArea:NICHE_SECTORS[0]});
 assert.equal(results.length,1);assert.equal(results[0].name,'Acoustics');assert.match(results[0].source,/specialist-evidence/);assert.match(prompt,/NOT an exclusive sector filter/);assert.match(prompt,/Do not assume a missing AI ranking/);
});
test('explicit sector selection still overrides automatic exploration hints',async()=>{
 let prompt='';const fetch=async(url,options)=>{prompt=JSON.parse(options.body).input;return Response.json({output:[{type:'message',content:[{type:'output_text',text:'{"businesses":[]}'}]}]})};
 const discover=new Function('fetch','parseJson','NICHE_SECTORS','process',discovery+';return discoverBusinesses;')(fetch,JSON.parse,NICHE_SECTORS,{env:{PERPLEXITY_API_KEY:'fixture'}});
 await discover({sector:NICHE_SECTORS[0],nicheFocus:true});assert.match(prompt,/from this sector only/);
});
