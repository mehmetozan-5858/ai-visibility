import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {notoSansBase64} from './assets/noto-sans-regular.mjs';

// Only the already-authorized free aggregates enter this renderer. No account,
// payment, source answer, credential or provider request belongs in this PDF.
export async function buildApplicantAssessmentPdf({business={},assessment={},language='tr'}={}){
 const count=x=>Number.isInteger(x)&&x>=0&&x<=100000?x:0;
 const samples=count(assessment.samples),providers=count(assessment.providers),queries=count(assessment.queries);
 const ready=assessment.status==='ready'&&samples>=6&&providers>=2&&queries>=2&&Number.isInteger(assessment.score)&&assessment.score>=0&&assessment.score<=100;
 const en=language==='en',pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(Buffer.from(notoSansBase64,'base64'),{subset:true}),supported=new Set(font.getCharacterSet());
 const clean=(x,max=180)=>[...String(x??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max)].map(c=>supported.has(c.codePointAt(0))?c:' ').join('');
 let page=pdf.addPage([595,842]);const ink=rgb(.06,.15,.22),muted=rgb(.30,.38,.44),accent=rgb(.04,.47,.58);
 page.drawRectangle({x:0,y:832,width:595,height:10,color:accent});
 const draw=(text,x,y,size=11,color=ink)=>page.drawText(clean(text,1200),{x,y,size,font,color});
 const paragraph=(text,y,{size=11,width=499,maxLines=8,color=muted}={})=>{
  const words=clean(text,1200).split(/\s+/).filter(Boolean);let line='',lines=[];
  for(const word of words){
   let rest=word;
   if(line&&font.widthOfTextAtSize(line+' '+word,size)>width){lines.push(line);line='';}
   while(font.widthOfTextAtSize(rest,size)>width){let n=1;while(n<rest.length&&font.widthOfTextAtSize(rest.slice(0,n+1),size)<=width)n++;lines.push(rest.slice(0,n));rest=rest.slice(n);}
   line=line?line+' '+rest:rest;
  }
  if(line)lines.push(line);
  for(const value of lines.slice(0,maxLines)){
   if(y-size<85){page=pdf.addPage([595,842]);page.drawRectangle({x:0,y:832,width:595,height:10,color:accent});draw('AI Visibility Works',48,786,18,accent);y=747;}
   draw(value,48,y,size,color);y-=size+6;
  }
  return y;
 };
 pdf.setTitle(en?'Free AI assessment - recorded evidence':'Ücretsiz AI ön değerlendirme - kayıtlı kanıt');
 pdf.setAuthor('AI Visibility Works');pdf.setSubject('Limited recorded sample summary; no paid access or payment evidence');
 draw('AI Visibility Works',48,786,18,accent);
 draw(en?'FREE AI ASSESSMENT':'ÜCRETSİZ AI ÖN DEĞERLENDİRME',48,751,20);
 let y=paragraph(business.name|| (en?'Business':'İşletme'),715,{size:15,maxLines:4,color:ink});
 y=paragraph([business.city,business.country,business.sector].filter(Boolean).join(' · '),y-6,{size:10,maxLines:3});
 y-=20;
 const cardY=y-68;
 for(const [i,[value,label]] of [[samples,en?'Eligible samples':'Uygun örnek'],[providers,en?'Providers':'Sağlayıcı'],[queries,en?'Different questions':'Farklı sorgu']].entries()){
  const x=48+i*170;page.drawRectangle({x,y:cardY,width:158,height:72,color:rgb(.94,.97,.98)});
  draw(String(value),x+14,cardY+39,23,accent);draw(label,x+14,cardY+16,10);
 }
 y=cardY-34;
 y=paragraph(ready?(en?'Recorded answer brand-match frequency: '+assessment.score+'/100':'Kayıtlı yanıtlarda marka eşleşme oranı: '+assessment.score+'/100'):(en?'Not enough eligible evidence; no score is displayed.':'Henüz yeterli uygun kanıt yok; skor gösterilmiyor.'),y,{size:13,color:ink,maxLines:3});
 const measuredAt=assessment.measuredAt&&Number.isFinite(Date.parse(assessment.measuredAt))?new Date(assessment.measuredAt).toLocaleString(en?'en-GB':'tr-TR',{timeZone:'Europe/Istanbul'}):null;
 y=paragraph(measuredAt?(en?'Latest eligible sample: ':'Son uygun kayıtlı yanıt: ')+measuredAt+(en?' (Türkiye time)':' (Türkiye saati)'):(en?'No eligible sample date available.':'Uygun örnek tarihi bulunmuyor.'),y-12,{size:10,maxLines:3});
 if(!ready)y=paragraph((en?'Additional minimum evidence needed: ':'Gerekli ek asgari uygun kanıt: ')+Math.max(0,6-samples)+(en?' samples, ':' örnek, ')+Math.max(0,2-providers)+(en?' providers, ':' sağlayıcı, ')+Math.max(0,2-queries)+(en?' different questions.':' farklı sorgu.'),y-12,{maxLines:3});
 y=paragraph(en?'Scope and limitations':'Kapsam ve sınırlar',y-24,{size:13,color:ink,maxLines:1});
 y=paragraph(en?'This is a summary of limited recorded model responses. It is not general market visibility, ranking, source verification or a sales guarantee. Failed or incomplete responses do not prove absence.':'Bu özet, sınırlı sayıdaki kayıtlı model yanıtlarına dayanır. Genel pazar görünürlüğü, sıralama, kaynak doğrulaması veya satış garantisi değildir. Başarısız veya eksik yanıtlar yokluk kanıtı sayılmaz.',y-5,{maxLines:6});
 paragraph(en?'Downloading this summary starts no AI request, sends no email and grants no customer or paid-report access. Detailed reports, service access and payment require separate verification.':'Bu özeti indirmek AI isteği veya e-posta başlatmaz; müşteri hesabı ya da ücretli rapor erişimi açmaz. Ayrıntılı rapor, hizmet erişimi ve ödeme ayrı doğrulama gerektirir.',y-12,{maxLines:6});
 const pages=pdf.getPages();for(const [i,p] of pages.entries()){page=p;draw('aivisibilityworks.com',48,42,9,muted);draw((en?'Recorded evidence summary · ':'Kayıtlı kanıt özeti · ')+(i+1)+'/'+pages.length,344,42,9,muted);}
 return pdf.save();
}
