import {PDFDocument,StandardFonts,rgb} from "pdf-lib";
import {getSalesCandidates} from "../../../../lib/repository";

export const runtime="nodejs";
const tr=v=>String(v??"").replaceAll("ğ","g").replaceAll("Ğ","G").replaceAll("ş","s").replaceAll("Ş","S").replaceAll("ı","i").replaceAll("İ","I").replaceAll("ç","c").replaceAll("Ç","C").replaceAll("ö","o").replaceAll("Ö","O").replaceAll("ü","u").replaceAll("Ü","U");
function wrap(text,max=82){const words=tr(text).split(/\s+/).filter(Boolean),lines=[];let line="";for(const w of words){const n=line?line+" "+w:w;if(n.length>max){if(line)lines.push(line);line=w}else line=n}if(line)lines.push(line);return lines}
function offer(score){
  if(score<=30)return {priority:"Yuksek",setup:"7.500-12.500 TL",monthly:"4.500-7.500 TL/ay",name:"AI Gorunurluk Hizli Iyilestirme Paketi"};
  if(score<=55)return {priority:"Orta",setup:"5.000-10.000 TL",monthly:"3.500-6.000 TL/ay",name:"AI Gorunurluk Baslangic Paketi"};
  return {priority:"Takip",setup:"5.000-7.500 TL",monthly:"2.500-4.500 TL/ay",name:"AI Gorunurluk Takip Paketi"};
}
export async function GET(req){
  try{
    const id=new URL(req.url).searchParams.get("clientId");
    const rows=await getSalesCandidates(50),c=rows.find(x=>x.id===id);
    if(!c)return Response.json({error:"Musteri bulunamadi."},{status:404});
    const o=offer(Number(c.score)||0),results=Array.isArray(c.results)?c.results:[];
    const pdf=await PDFDocument.create(),reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
    const W=595,H=842,M=44;let page=pdf.addPage([W,H]),y=H-M;
    const need=h=>{if(y-h<M){page=pdf.addPage([W,H]);y=H-M}};
    const line=(t,s=10,font=reg,color=rgb(.12,.18,.22),gap=4)=>{need(s+gap);page.drawText(tr(t),{x:M,y:y-s,size:s,font,color});y-=s+gap};
    const para=(t,s=9)=>{for(const l of wrap(t))line(l,s,reg,rgb(.22,.3,.34),2);y-=2};
    const bullet=t=>{for(const [i,l] of wrap(t,76).entries())line((i?"  ":"- ")+l,9,reg,rgb(.22,.3,.34),2)};
    line("AI VISIBILITY",10,bold,rgb(.08,.45,.78),5);
    line("AI Gorunurluk Teklifi",24,bold,rgb(.05,.12,.16),7);
    line(c.name,15,bold,rgb(.08,.24,.31),4);line(c.domain||"Web sitesi belirtilmedi",9,reg,rgb(.42,.5,.55),12);
    line("Genel gorunurluk skoru: "+c.score+"/100",14,bold,rgb(.04,.25,.36),5);
    line("Firsat onceligi: "+o.priority,10,bold,rgb(.08,.35,.48),12);
    line("Saglayici sonuclari",13,bold,rgb(.05,.12,.16),5);
    for(const r of results)line((r.provider||"AI")+": "+(r.score??"-")+"/100",10,bold,rgb(.08,.35,.48),3);
    y-=6;line("Onerilen paket",13,bold,rgb(.05,.12,.16),5);line(o.name,11,bold,rgb(.08,.24,.31),4);
    line("Kurulum: "+o.setup,10);line("Aylik hizmet: "+o.monthly,10,reg,rgb(.12,.18,.22),8);
    ["ChatGPT + Gemini + Perplexity gorunurluk takibi","GEO/AEO teknik ve icerik iyilestirme plani","Aylik karsilastirmali gorunurluk raporu","Icerik onerileri ve oncelikli aksiyon listesi"].forEach(bullet);
    y-=8;line("Not",10,bold,rgb(.08,.24,.31),3);para("Bu teklif on bilgilendirme amaclidir. Nihai kapsam ve fiyat, musteri onayi ve is kapsamindan sonra kesinlestirilir.",8);
    const bytes=await pdf.save(),filename="ai-visibility-teklif-"+tr(c.name).toLowerCase().replace(/[^a-z0-9]+/g,"-")+".pdf";
    return new Response(bytes,{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="${filename}"`,"cache-control":"no-store"}});
  }catch(e){return Response.json({error:"Teklif PDF olusturulamadi.",detail:String(e?.message||e).slice(0,240)},{status:500})}
}
