import {buildOrderGuideDraft} from './order-guide-draft.mjs';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

// Standalone vector preview; no remote images, scripts, links or publication.
export function renderOrderGuideSocialDraft(input,{format='post'}={}){
 if(!['post','story'].includes(format))throw new TypeError('Invalid format');
 const draft=buildOrderGuideDraft(input);
 const width=1080,height=format==='post'?1350:1920;
 const top=format==='post'?80:270;
 const brand=draft.brand;
 if([...brand].length>36)throw new RangeError('Brand too long for social preview');
 const steps=[
 ['Lieblingslook wählen','Wähle deinen gewünschten Artikel.'],
 ['Artikel & Größe','Notiere den Artikelcode und deine Größe.'],
 ['Per WhatsApp anfragen','Sende uns deine Anfrage.'],
 ['Rückmeldung erhalten','Wir klären Verfügbarkeit, Preis und Ablauf.']
 ];
 const text=(x,y,size,value,extra='')=>`<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" fill="#241f1b" ${extra}>${escape(value)}</text>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Bestellanleitung Entwurf">
 <rect width="1080" height="${height}" fill="#f5f0e8"/>
 <rect x="48" y="48" width="984" height="${height-96}" rx="12" fill="none" stroke="#a69987" stroke-width="2"/>
 ${text(90,top+35,25,'ENTWURF · NICHT VERÖFFENTLICHEN')}
 ${text(90,top+115,brand.length>22?40:60,brand,'font-weight="700"')}
 ${text(90,top+185,48,'So bestellst du bei uns','font-weight="700"')}
 ${steps.map(([title,detail],i)=>{const y=top+275+i*165;return `<rect x="90" y="${y-52}" width="900" height="145" rx="14" fill="#fffaf2"/><circle cx="153" cy="${y+12}" r="38" fill="#d6c6af"/>${text(153,y+24,32,String(i+1).padStart(2,'0'),'text-anchor="middle" font-weight="700"')}${text(218,y+2,35,title,'font-weight="700"')}${text(218,y+48,29,detail)}`;}).join('')}
 ${text(90,top+1000,32,draft.whatsappUrl?'WhatsApp-Link vor Freigabe prüfen':'WhatsApp-Link noch zu bestätigen','font-weight="700"')}
 ${text(90,top+1060,25,'AI Visibility Works · Gestaltungsvorschlag')}
 </svg>`;
}
