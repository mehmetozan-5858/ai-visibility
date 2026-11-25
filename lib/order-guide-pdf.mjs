import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';
import {buildOrderGuideDraft} from './order-guide-draft.mjs';

// Offline draft export. No customer access grant, publication or external request.
export async function exportOrderGuideDraftPdf(input) {
  const draft=buildOrderGuideDraft(input);
  const pdf=await PDFDocument.create();
  const page=pdf.addPage([595,842]);
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink=rgb(.16,.15,.14), muted=rgb(.36,.33,.29);
  const write=(line,x,y,size=12,font=regular,color=ink)=>page.drawText(line,{x,y,size,font,color});
  const wrap=(line,size,font,max)=>{const lines=[];let current='';for(const word of line.split(/\s+/)){const candidate=current?current+' '+word:word;if(font.widthOfTextAtSize(candidate,size)>max){if(!current)throw new Error('Text exceeds page width');lines.push(current);current=word;if(font.widthOfTextAtSize(current,size)>max)throw new Error('Text exceeds page width');}else current=candidate;}if(current)lines.push(current);return lines;};
  page.drawRectangle({x:0,y:0,width:595,height:842,color:rgb(.97,.95,.91)});
  write('AI VISIBILITY WORKS',44,795,12,bold,muted);
  write('ENTWURF - NICHT ZUR VERÖFFENTLICHUNG',44,770,10,bold);
  let y=730;
  for(const line of wrap(draft.brand,22,bold,507)){write(line,44,y,22,bold);y-=28;}
  write(draft.title,44,y,20,bold);y-=52;
  for(const [i,step] of draft.steps.entries()){
    write(String(i+1).padStart(2,'0'),44,y,17,bold,muted);
    for(const line of wrap(step,14,regular,450)){write(line,88,y,14);y-=20;}
    y-=22;
  }
  write('WhatsApp-Nachricht',44,y,16,bold);y-=26;
  for(const paragraph of draft.message.split('\n'))for(const line of wrap(paragraph,12,regular,507)){write(line,44,y);y-=18;}
  y-=18;
  write('Bestelllink: '+(draft.whatsappUrl||'noch zu bestätigen'),44,y,11);y-=24;
  const labels={whatsappUrl:'WhatsApp-Link',code:'Artikelcode',sizes:'Größen',price:'Preis',delivery:'Versand / Abholung'};
  write('Vor Freigabe zu prüfen:',44,y,11,bold);y-=18;
  for(const line of wrap(draft.missing.length?draft.missing.map(k=>labels[k]).join(', '):'Alle Eingaben durch ZERA bestätigen lassen.',11,regular,507)){write(line,44,y,11);y-=16;}
  if(y<48)throw new Error('Draft exceeds page height');
  write('Keine Veröffentlichung ohne ausdrückliche Freigabe.',44,35,10,regular,muted);
  return pdf.save();
}
