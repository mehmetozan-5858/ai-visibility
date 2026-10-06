import {upsertClientProfile,getClientProfile} from "../../../lib/client-profile";
import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";
import {getCommunicationProspect,linkProspectToClient,getLatestProspectAnalysis} from "../../../lib/prospects";
import {addClient,getClient,findClientByIdentity,getLatestCompletedScan,createScan,completeScan} from "../../../lib/repository";
import {createPaymentAccessToken} from "../../../lib/admin-auth";
export const runtime="nodejs";
const serviceMap={"AI Visibility Diagnosis":"business-diagnosis","AI Visibility Solution":"business-solution","AI Visibility Monitoring":"business-monitoring"};
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;const originError=enforceSameOrigin(req);if(originError)return originError;
 try{
  const {prospectId}=await req.json();const x=await getCommunicationProspect(prospectId);
  if(!x)return Response.json({error:"Aday bulunamadı."},{status:404});
  if(!["interested","meeting","proposal"].includes(String(x.replyStatus||""))&&!["warm","meeting","proposal"].includes(String(x.crmStage||"")))return Response.json({error:"Ödeme bağlantısı için müşteri ilgisi doğrulanmalı."},{status:409});
  const client=(x.clientId?await getClient(x.clientId):null)||await findClientByIdentity(x.name,x.domain)||await addClient({name:x.name,domain:x.domain,plan:x.proposalPackage||"Starter",competitors:[]});
  if(!client?.id)return Response.json({error:"Müşteri kaydı kalıcı oluşturulamadı."},{status:500});
  if(!await getClientProfile(client.id))await upsertClientProfile(client.id,{country:x.country,city:x.city,sector:x.sector,contactEmail:x.contactEmail});
  if(!await getLatestCompletedScan(client.id)){const analysis=await getLatestProspectAnalysis(x.id);if(analysis){const scan=await createScan(client.id,[]);await completeScan(scan.id,analysis)}}
  const service=serviceMap[x.proposalPackage]||"business-diagnosis";const token=await createPaymentAccessToken(client.id,604800,service);
  await linkProspectToClient(x.id,client.id);
  const base=process.env.PUBLIC_APP_URL||"https://www.aivisibilityworks.com";
  return Response.json({ok:true,clientId:client.id,paymentUrl:`${base}/odeme?token=${encodeURIComponent(token)}`,expiresInDays:7,service});
 }catch(e){return Response.json({error:"Güvenli ödeme bağlantısı hazırlanamadı.",detail:String(e?.message||e).slice(0,180)},{status:500})}
}
