import {createPilot} from './zera-pilot.mjs';
/**
 * Idempotent ZERA client registration. A retry must also repair the customer
 * profile if a previous registration inserted the client but profile write failed.
 * Never grants any administrative permissions to ZERA.
 */
export async function registerZeraPilot({approved=false,find,add,profile}={}){
 if(!approved)throw new Error('Registration requires explicit owner approval');
 const p=createPilot();
 if(!find||!add){
  const repository=await import('../lib/repository.js');
  find??=repository.findClientByIdentity;
  add??=repository.addClient;
 }
 const existing=await find(p.brand,'');
 const row=existing||await add({name:p.brand,domain:'',plan:'Pilot',competitors:[]});
 if(!row?.id || (!existing&&!row?.persisted))throw new Error('Persistent database unavailable: registration not complete');
 if(!profile){const mod=await import('../lib/client-profile.js');profile=mod.upsertClientProfile;}
 await profile(row.id,{country:'Germany',city:'Wetzlar',sector:"Women's clothing",contactEmail:p.email,requestedService:'Free public-scope GEO/AEO pilot'});
 return {clientId:row.id,created:!existing,status:existing?'existing-profile-verified':'registered',pilotId:p.id,role:'customer'};
}
