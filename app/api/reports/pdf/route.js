import {PDFDocument,StandardFonts,rgb} from "pdf-lib";
import {listClients,listScans} from "../../../../lib/repository";

export const runtime="nodejs";

const tr=v=>String(v??"")
  .replaceAll("ğ","g").replaceAll("Ğ","G")
  .replaceAll("ş","s").replaceAll("Ş","S")
  .replaceAll("ı","i").replaceAll("İ","I");

function wrap(text,max=82){
  const words=tr(text).split(/\s+/).filter(Boolean);
  const lines=[]; let line="";
  for(const w of words){
    const next=line?line+" "+w:w;
    if(next.length>max){ if(line)lines.push(line); line=w; }
    else line=next;
  }
  if(line)lines.push(line);
  return lines;
}

export async function GET(req){
  try{
    const url=new URL(req.url);
    const clientId=url.searchParams.get("clientId")||"";
    const [allScans,clients]=await Promise.all([listScans(100),listClients()]);
    const rows=clientId?allScans.filter(x=>x.clientId===clientId):allScans;
    const completed=rows.filter(x=>x.status==="completed"&&Number.isFinite(Number(x.score)));
    const avg=completed.length?Math.round(completed.reduce((a,x)=>a+Number(x.score),0)/completed.length):null;
    const client=clientId?clients.find(x=>x.id===clientId):null;

    const pdf=await PDFDocument.create();
    const regular=await pdf.embedFont(StandardFonts.Helvetica);
    const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
    const W=595,H=842,M=42;
    let page=pdf.addPage([W,H]),y=H-M;

    const newPage=()=>{page=pdf.addPage([W,H]);y=H-M;};
    const need=h=>{if(y-h<M)newPage();};
    const line=(text,size=10,font=regular,color=rgb(.12,.18,.22),gap=4)=>{
      need(size+gap);
      page.drawText(tr(text),{x:M,y:y-size,size,font,color});
      y-=size+gap;
    };
    const paragraph=(text,size=10,font=regular,color=rgb(.2,.28,.33),max=82)=>{
      for(const l of wrap(text,max))line(l,size,font,color,3);
      y-=3;
    };
    const bullets=(arr=[])=>{
      for(const item of arr.slice(0,8)){
        for(const [i,l] of wrap(item,74).entries()) line((i===0?"- ":"  ")+l,9,regular,rgb(.22,.3,.34),2);
      }
      y-=3;
    };

    line("AI VISIBILITY",10,bold,rgb(.08,.45,.78),5);
    line("Gorunurluk Raporu",24,bold,rgb(.05,.12,.16),7);
    line(client?client.name:"Tum Musteriler",14,regular,rgb(.35,.44,.5),10);
    line("Toplam tarama: "+rows.length+"    Tamamlanan: "+completed.length+"    Ortalama skor: "+(avg==null?"-":avg+"/100"),11,bold,rgb(.08,.24,.31),14);
    line("Tamamlanan taramalar",15,bold,rgb(.05,.12,.16),9);

    if(!completed.length){
      paragraph("Tamamlanmis tarama bulunamadi.");
    }

    for(const scan of completed){
      need(90);
      line(scan.clientName||"Musteri",13,bold,rgb(.04,.19,.28),4);
      const dt=new Date(scan.completedAt||scan.createdAt);
      line("Tarih: "+dt.toLocaleString("tr-TR")+"   Skor: "+scan.score+"/100",9,regular,rgb(.42,.5,.55),6);
      const results=Array.isArray(scan.results)?scan.results:[];
      for(const result of results){
        need(55);
        line((result.provider||"AI")+" - "+(result.score??"-")+"/100",10,bold,rgb(.08,.35,.48),4);
        if(result.summary)paragraph(result.summary,9);
        if(Array.isArray(result.findings)&&result.findings.length){
          line("Bulgular",9,bold,rgb(.08,.24,.31),2); bullets(result.findings.slice(0,4));
        }
        if(Array.isArray(result.recommendations)&&result.recommendations.length){
          line("Oneriler",9,bold,rgb(.08,.24,.31),2); bullets(result.recommendations.slice(0,4));
        }
      }
      y-=8;
    }

    need(30);
    line("AI Visibility tarafindan olusturuldu.",8,regular,rgb(.52,.59,.63),0);

    const bytes=await pdf.save();
    const filename="ai-visibility-"+tr(client?.name||"tum-musteriler").toLowerCase().replace(/[^a-z0-9]+/g,"-")+".pdf";
    return new Response(bytes,{
      headers:{
        "content-type":"application/pdf",
        "content-disposition":`attachment; filename="${filename}"`,
        "cache-control":"no-store"
      }
    });
  }catch(e){
    return Response.json({error:"PDF raporu olusturulamadi.",detail:String(e?.message||e).slice(0,300)},{status:500});
  }
}
