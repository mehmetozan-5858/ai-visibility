import {createPilot} from './zera-pilot.mjs';
/** Pilot registration: inject dependencies in tests, load actual Next.js repository only when invoked. */
export async function registerZeraPilot({approved=false,find,add,profile}={}){
 if(!approved)throw new Error('Registration requires explicit owner approval');
 const p=createPilot();
 if(!find||!add){
   const repository=await import('../lib/repository.js');
   find??=repository.findClientByIdentity;
   add??=repository.addClient;
 }
 const existing=await find(p.brand,'');
 if(existing)return {clientId:existing.id,created:false,status:'existing',pilotId:p.id};
 const row=await add({name:p.brand,domain:'',plan:'Pilot',competitors:[]});
 if(!row?.persisted)throw new Error('Persistent database unavailable: registration not complete');
 if(!profile){const mod=await import('../lib/client-profile.js');profile=mod.upsertClientProfile;}
 await profile(row.id,{country:'Germany',city:'Wetzlar',sector:"Women's clothing",contactEmail:p.email,requestedService:'Free public-scope GEO/AEO pilot'});
 return {clientId:row.id,created:true,status:'registered',pilotId:p.id};
}
