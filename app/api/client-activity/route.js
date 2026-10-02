import {addClientActivity,getClientAccount,getClient} from "../../../lib/repository";

export async function GET(req){
  try{
    const clientId=new URL(req.url).searchParams.get("clientId")||"";
    if(!clientId)return Response.json({error:"Müşteri seçilmelidir."},{status:400});
    const account=await getClientAccount(clientId);
    if(!account)return Response.json({error:"Müşteri bulunamadı."},{status:404});
    return Response.json({account});
  }catch(e){
    return Response.json({error:"İşletme hesabı okunamadı.",detail:String(e?.message||e).slice(0,220)},{status:500});
  }
}

export async function POST(req){
  try{
    const body=await req.json();
    if(!body?.clientId)return Response.json({error:"Müşteri seçilmelidir."},{status:400});
    if(!await getClient(body.clientId))return Response.json({error:"Müşteri bulunamadı."},{status:404});
    const activity=await addClientActivity(body.clientId,{
      eventType:body.eventType,
      title:body.title,
      detail:body.detail,
      metadata:{manual:true}
    });
    return Response.json({activity},{status:201});
  }catch(e){
    return Response.json({error:"Faaliyet kaydı eklenemedi.",detail:String(e?.message||e).slice(0,220)},{status:500});
  }
}
