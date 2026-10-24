import {findClientByIdentity,addClient} from '../lib/repository.js';
import {upsertClientProfile} from '../lib/client-profile.js';
import {createPilot} from './zera-pilot.mjs';
/** Owner-controlled one-time pilot registration. Never guesses an official website. */
export async function registerZeraPilot({approved=false,find=findClientByIdentity,add=addClient,profile=upsertClientProfile}={}){
 if(!approved)throw new Error('Registration requires explicit owner approval');
 const p=createPilot();
 const existing=await find(p.brand,'');
 if(existing)return {clientId:existing.id,created:false,status:'existing',pilotId:p.id};
 const row=await add({name:p.brand,domain:'',plan:'Pilot',competitors:[]});
 if(!row?.persisted)throw new Error('Persistent database unavailable: registration not complete');
 await profile(row.id,{country:'Germany',city:'Wetzlar',sector:'Women's clothing',contactEmail:p.email,requestedService:'Free public-scope GEO/AEO pilot'});
 return {clientId:row.id,created:true,status:'registered',pilotId:p.id};
}
