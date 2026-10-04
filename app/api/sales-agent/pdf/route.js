import {PDFDocument,StandardFonts,rgb} from "pdf-lib";
import {getSalesCandidates} from "../../../../lib/repository";
import {getClientProfile} from "../../../../lib/client-profile";
import {servicePrice,formatMoney} from "../../../../lib/regional-pricing";

export const runtime="nodejs";
const tr=v=>String(v??"").replaceAll("ğ","g").replaceAll("Ğ","G").replaceAll("ş","s").replaceAll("Ş","S").replaceAll("ı","i").replaceAll("İ","I").replaceAll("ç","c").replaceAll("Ç","C").replaceAll("ö","o").replaceAll("Ö","O").replaceAll("ü","u").replaceAll("Ü","U");
function wrap(text,max=82){const words=tr(text).split(/\s+/).filter(Boolean),lines=[];let line="";for(const w of words){const n=line?line+" "+w:w;if(n.length>max){if(line)lines.push(line);line=w}else line=n}if(line)lines.push(line);return lines}
function money(p){const locale=p.currency==="TRY"?"tr-TR":p.currency==="GBP"?"en-GB":p.currency==="EUR"?"en-IE":"en-US";return formatMoney(p.amount,p.currency,locale)}

export async function GET(req){
  try{
    const id=new URL(req.url).searchParams.get("clientId");
    const rows=await getSalesCandidates(50),c=rows.find(x=>x.id===id);
    if(!c)return Response.json({error:"Musteri bulunamadi."},{status:404});
    const profile=await getClientProfile(c.id).catch(()=>null);
    const country=String(profile?.country||"Türkiye").trim();
    const diagnosis=servicePrice({service:"business-diagnosis",country,language:"tr"});
    const solution=servicePrice({service:"business-solution",country,language:"tr"});
    const monitoring=servicePrice({service:"business-monitoring",country,language:"tr"});
    const results=Array.isArray(c.results)?c.results:[];
    const pdf=await PDFDocument.create(),reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
    const W=595,H=842,M=44;let page=pdf.addPage([W,H]),y=H-M;
    const need=h=>{if(y-h<M){page=pdf.addPage([W,H]);y=H-M}};
    const line=(t,s=10,font=reg,color=rgb(.12,.18,.22),gap=4)=>{need(s+gap);page.drawText(tr(t),{x:M,y:y-s,size:s,font,color});y-=s+gap};
    const para=(t,s=9)=>{for(const l of wrap(t))line(l,s,reg,rgb(.22,.3,.34),2);y-=2};
    const bullet=t=>{for(const [i,l] of wrap(t,76).entries())line((i?"  ":"- ")+l,9,reg,rgb(.22,.3,.34),2)};
    line("AI VISIBILITY",10,bold,rgb(.08,.45,.78),5);
    line("AI Gorunurluk Teklifi",24,bold,rgb(.05,.12,.16),7);
    line(c.name,15,bold,rgb(.08,.24,.31),4);line(c.domain||"Web sitesi belirtilmedi",9,reg,rgb(.42,.5,.55),6);
    line("Fiyat bolgesi: "+country+" / "+diagnosis.currency,9,reg,rgb(.42,.5,.55),12);
    line("Genel gorunurluk skoru: "+c.score+"/100",14,bold,rgb(.04,.25,.36),10);
    line("Saglayici sonuclari",13,bold,rgb(.05,.12,.16),5);
    for(const r of results)line((r.provider||"AI")+": "+(r.score??"-")+"/100",10,bold,rgb(.08,.35,.48),3);
    y-=6;
    line("Hizmet modeli",13,bold,rgb(.05,.12,.16),5);
    line("1. Sorun tespit + profesyonel rapor: "+money(diagnosis),10);
    line("2. Cozum / uygulama baslangic paketi: "+money(solution)+"'dan",10);
    line("3. Surekli takip + optimizasyon: "+money(monitoring)+"/ay",10,reg,rgb(.12,.18,.22),8);
    ["ChatGPT + Gemini + Perplexity gorunurluk takibi","Sorunlarin tespiti ve onceliklendirilmesi","GEO/AEO teknik ve icerik cozum plani","Musteri onayi sonrasi uygulama gorevleri","Aylik karsilastirmali gorunurluk ve optimizasyon"].forEach(bullet);
    y-=8;
    line("Calisma sekli",13,bold,rgb(.05,.12,.16),5);
    ["1. Mevcut durum yapay zeka motorlarinda olculur.","2. Sorunlar ve firsatlar raporlanir.","3. Musteri cozum paketini secerse uygulama ajanlari gorevlendirilir.","4. Aylik takip secildiginde yeni sorunlar, rakip hareketleri ve skor degisimi yeniden olculur."].forEach(x=>para(x,9));
    y-=5;
    line("Musteriden gerekenler",12,bold,rgb(.05,.12,.16),4);
    ["Gerekli web sitesi erisimi veya teknik ekip koordinasyonu","Google Isletme Profili yetkisi gereken islemlerde yonetici erisimi","Adres, telefon, calisma saati, fiyat ve menu gibi gercek bilgilerin onayi"].forEach(bullet);
    y-=8;line("Not",10,bold,rgb(.08,.24,.31),3);para("Sorun tespit ve rapor ucreti tek seferliktir. Cozum paketi is kapsaminin yogunluguna gore baslangic fiyatindan yukari cikabilir. Surekli takip ve optimizasyon aylik hizmettir. Dis sistemlerde degisiklikler yetki ve onay olmadan yapilmaz.",8);
    const bytes=await pdf.save(),filename="ai-visibility-teklif-"+tr(c.name).toLowerCase().replace(/[^a-z0-9]+/g,"-")+".pdf";
    return new Response(bytes,{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="${filename}"`,`cache-control`:"no-store"}});
  }catch(e){return Response.json({error:"Teklif PDF olusturulamadi.",detail:String(e?.message||e).slice(0,240)},{status:500})}
}
