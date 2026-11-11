import {assessRelease} from './release-assurance.mjs';
import {prepareLaunchAuditEvent} from './ai-visibility-launch-audit.mjs';
import {planLaunchService} from './ai-visibility-launch-services.mjs';

// Fixed synthetic fixtures only. Never accepts customer data or executes a plan.
export function runAuditPilot(){
 const targetSha='a'.repeat(40),rollbackSha='b'.repeat(40);
 const check={id:1,name:'synthetic-ci',head_sha:targetSha,status:'completed',conclusion:'success'};
 const release=checks=>assessRelease({targetSha,rollbackSha,requiredChecks:['synthetic-ci'],checks});
 const scope={tenantId:'synthetic-tenant',actorId:'synthetic-actor',serviceId:'agent-audit-control',eventType:'report-prepared',occurredAt:'2026-11-11T00:00:00.000Z'};
 const cases=[
  {id:'matching-check',name:'Eşleşen test kaydı kabul edilir; yayın yetkisi verilmez',run:()=>{const r=release([check]);return r.state==='checks-verified'&&r.deploymentAuthorized===false&&r.requiresRuntimeAndCustomerAcceptance===true;}},
  {id:'missing-check',name:'Eksik test kanıtı engellenir',run:()=>release([]).state==='blocked'},
  {id:'wrong-commit',name:'Başka sürüme ait test kanıtı engellenir',run:()=>release([{...check,head_sha:rollbackSha}]).state==='blocked'},
  {id:'ambiguous-runs',name:'Çelişkili veya yinelenen test kayıtları engellenir',run:()=>release([check,{...check,id:2,conclusion:'failure'}]).state==='blocked'},
  {id:'invalid-identity',name:'Geçersiz kimlik denetim olayına alınmaz',run:()=>prepareLaunchAuditEvent({...scope,tenantId:'invalid/tenant'}).ok===false},
  {id:'prepared-only',name:'Denetim olayı hazırlanır; kalıcı kayıt iddiası üretilmez',run:()=>{const r=prepareLaunchAuditEvent(scope);return r.ok===true&&r.event.state==='prepared-not-persisted';}},
  {id:'plan-not-execution',name:'Hazırlanan ajan planı gerçek işlem yetkisi vermez',run:()=>{const r=planLaunchService({serviceId:'agent-audit-control',capability:'release-evidence',tenantId:'synthetic-tenant'});return r.ok===true&&r.executes===false&&r.requiresAuthorization===true&&r.requiresProductionEnablement===true;}}
 ];
 const results=cases.map(({id,name,run})=>{try{return {id,name,passed:run()===true}}catch{return {id,name,passed:false}}});
 return {module:'RD-03',name:'AI Agent Audit & Control',phase:'synthetic-live-pilot',
  scope:'synthetic-only',customerDataRead:false,externalActions:false,persistentAudit:false,
  productionCustomerAcceptance:false,paidProviderCalls:0,
  passed:results.filter(r=>r.passed).length,total:results.length,
  ok:results.every(r=>r.passed),results};
}
