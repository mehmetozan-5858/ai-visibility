import {PDFDocument,StandardFonts,rgb} from "pdf-lib";
import {reportArtBase64} from "./report-brand-art.js";


const tr=v=>String(v??"")
  .replaceAll("ğ","g").replaceAll("Ğ","G")
  .replaceAll("ş","s").replaceAll("Ş","S")
  .replaceAll("ı","i").replaceAll("İ","I")
  .replaceAll("ç","c").replaceAll("Ç","C")
  .replaceAll("ö","o").replaceAll("Ö","O")
  .replaceAll("ü","u").replaceAll("Ü","U")
  .replace(/[–—]/g,"-").replace(/[“”]/g,'"').replace(/[‘’]/g,"'")
  .replace(/[^\x20-\x7e\xa0-\xff]/g," ");

function wrap(text,max=86){
  const words=tr(text).split(/\s+/).filter(Boolean);
  const lines=[];let line="";
  for(const w of words){
    const next=line?line+" "+w:w;
    if(next.length>max){if(line)lines.push(line);line=w}else line=next;
  }
  if(line)lines.push(line);
  return lines;
}

function latestPerClient(rows=[]){
  const map=new Map();
  for(const row of rows){
    if(row.status!=="completed"||!Number.isFinite(Number(row.score)))continue;
    if(!map.has(row.clientId))map.set(row.clientId,row);
  }
  return [...map.values()];
}

export async function buildReportResponse({allScans,clients,clientId=""}){
    const client=clientId?clients.find(x=>x.id===clientId):null;

    let completed;
    if(clientId){
      completed=allScans.filter(x=>x.clientId===clientId&&x.status==="completed"&&Number.isFinite(Number(x.score))).slice(0,1);
    }else{
      completed=latestPerClient(allScans);
    }

    const pdf=await PDFDocument.create();
    const regular=await pdf.embedFont(StandardFonts.Helvetica);
    const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
    const artwork=await pdf.embedJpg(Buffer.from(reportArtBase64,"base64"));
    const W=595,H=842,M=42;
    const decorate=page=>{
      page.drawImage(artwork,{x:62,y:180,width:471,height:471,opacity:.055});
      page.drawRectangle({x:0,y:H-9,width:W,height:9,color:rgb(.035,.12,.23)});
      page.drawText("AI",{x:M,y:H-54,size:25,font:bold,color:rgb(.04,.65,.82)});
      page.drawText("Visibility",{x:M+39,y:H-54,size:25,font:bold,color:rgb(.035,.12,.23)});
      page.drawText("DIGITAL VISIBILITY INTELLIGENCE",{x:M,y:H-72,size:8,font:regular,color:rgb(.4,.5,.58)});
      page.drawText("aivisibilityworks.com",{x:W-M-118,y:H-54,size:10,font:regular,color:rgb(.15,.37,.52)});
      page.drawLine({start:{x:M,y:H-88},end:{x:W-M,y:H-88},thickness:1,color:rgb(.1,.67,.77)});
    };
    let page=pdf.addPage([W,H]),y=H-112;
    decorate(page);

    const newPage=()=>{page=pdf.addPage([W,H]);decorate(page);y=H-112;};
    const need=h=>{if(y-h<70)newPage();};
    const line=(text,size=10,font=regular,color=rgb(.12,.18,.22),gap=4)=>{
      need(size+gap);page.drawText(tr(text),{x:M,y:y-size,size,font,color});y-=size+gap;
    };
    const paragraph=(text,size=9,font=regular,color=rgb(.2,.28,.33),max=86)=>{
      for(const l of wrap(text,max))line(l,size,font,color,2);y-=2;
    };
    const bullets=(arr=[],maxItems=4)=>{
      for(const item of arr.slice(0,maxItems)){
        for(const [i,l] of wrap(item,78).entries())line((i===0?"- ":"  ")+l,8.5,regular,rgb(.22,.3,.34),1.5);
      }
      y-=2;
    };

    if(client?.domain?.endsWith(".local")||completed.some(scan=>scan.results?.some(r=>r.provider==="Test Provider")))line("TEST RAPORU - Gercek isletme analizi veya tahsilat kaniti degildir.",9,bold,rgb(.7,.25,.08),8);
    line(client?"AI Gorunurluk Raporu":"AI Gorunurluk Portfoy Ozeti",22,bold,rgb(.05,.12,.16),6);
    line(client?client.name:"Son taramasi bulunan musteriler",13,regular,rgb(.35,.44,.5),12);

    if(!completed.length){
      paragraph("Tamamlanmis tarama bulunamadi.");
    } else if(!clientId){
      const avg=Math.round(completed.reduce((a,x)=>a+Number(x.score),0)/completed.length);
      line("Musteri: "+completed.length+"    Ortalama skor: "+avg+"/100",11,bold,rgb(.08,.24,.31),12);
      line("Son gorunurluk sonuclari",14,bold,rgb(.05,.12,.16),7);
      for(const scan of completed){
        need(34);
        line((scan.clientName||"Musteri")+"    "+scan.score+"/100",10,bold,rgb(.04,.19,.28),2);
        const results=Array.isArray(scan.results)?scan.results:[];
        if(results.length)line(results.map(r=>(r.provider||"AI")+" "+(r.score??"-")+"/100").join("   "),8.5,regular,rgb(.38,.47,.52),5);
      }
      y-=6;
      paragraph("Detayli musteri raporu icin uygulamada tek bir musteri secin ve PDF raporunu yeniden indirin.",8,regular,rgb(.45,.52,.56));
    } else {
      const scan=completed[0];
      line("Genel AI gorunurluk skoru: "+scan.score+"/100",14,bold,rgb(.04,.25,.36),8);
      const dt=new Date(scan.completedAt||scan.createdAt);
      line("Son tarama: "+dt.toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"}),9,regular,rgb(.42,.5,.55),12);

      const results=Array.isArray(scan.results)?scan.results:[];
      line("Saglayici sonuclari",14,bold,rgb(.05,.12,.16),7);
      line(results.map(r=>(r.provider||"AI")+": "+(r.score??"-")+"/100").join("    "),10,bold,rgb(.08,.35,.48),12);

      const findings=[...new Set(results.flatMap(r=>Array.isArray(r.findings)?r.findings:[]).filter(Boolean))].slice(0,3);
      const recs=[...new Set(results.flatMap(r=>Array.isArray(r.recommendations)?r.recommendations:[]).filter(Boolean))].slice(0,4);

      line("Yonetici ozeti",14,bold,rgb(.05,.12,.16),7);
      paragraph("Bu rapor, markanin ChatGPT, Gemini ve Perplexity uzerindeki mevcut yapay zeka gorunurlugunu birlikte degerlendirir. Amac yalnizca eksikleri gostermek degil, uygulanabilir bir iyilestirme plani olusturmaktir.",9);

      if(findings.length){
        line("En onemli bulgular",12,bold,rgb(.05,.12,.16),5);
        bullets(findings,3);
      }

      if(recs.length){
        line("Bizim uygulayacagimiz oncelikli isler",12,bold,rgb(.05,.12,.16),5);
        bullets(recs,4);
      }

      line("Musteriden gerekenler",12,bold,rgb(.05,.12,.16),5);
      bullets([
        "Web sitesi yonetim erisimi veya teknik ekip ile iletisim izni",
        "Google Isletme Profili icin gerekli yonetici yetkisi",
        "Adres, telefon, calisma saatleri, fiyat ve menu gibi gercek isletme bilgilerinin onayi"
      ],3);

      line("Sonraki adim",12,bold,rgb(.05,.12,.16),5);
      paragraph("Onaydan sonra uygulama gorevleri siraya alinir, gerekli duzenlemeler yapilir ve sonraki taramada skor degisimi ChatGPT, Gemini ve Perplexity uzerinde tekrar olculur.",9);
    }

    need(28);
    line("AI Visibility - ChatGPT, Gemini ve Perplexity gorunurluk analizi",8,regular,rgb(.52,.59,.63),0);

    for(const [index,p] of pdf.getPages().entries()){
      p.drawLine({start:{x:M,y:51},end:{x:W-M,y:51},thickness:.5,color:rgb(.77,.84,.88)});
      p.drawText("AI Visibility | aivisibilityworks.com",{x:M,y:35,size:8,font:regular,color:rgb(.4,.5,.58)});
      p.drawText(`${index+1} / ${pdf.getPageCount()}`,{x:W-M-28,y:35,size:8,font:regular,color:rgb(.4,.5,.58)});
    }

    const bytes=await pdf.save();
    const filename="ai-visibility-"+tr(client?.name||"portfoy-ozeti").toLowerCase().replace(/[^a-z0-9]+/g,"-")+".pdf";
    return new Response(bytes,{headers:{
      "content-type":"application/pdf",
      "content-disposition":`attachment; filename="${filename}"`,
      "cache-control":"no-store"
    }});
}
