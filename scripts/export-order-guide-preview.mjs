import {mkdir,writeFile} from 'node:fs/promises';
import {exportOrderGuideDraftPdf} from '../lib/order-guide-pdf.mjs';
import {exportOrderGuideSocialPng} from '../lib/order-guide-social-png.mjs';
await mkdir('artifacts/order-guide',{recursive:true});
const bytes=await exportOrderGuideDraftPdf({brand:process.argv[2] || 'Example'});
await writeFile('artifacts/order-guide/bestellanleitung-entwurf.pdf',bytes);

for(const format of ['post','story']){
 const png=await exportOrderGuideSocialPng({brand:process.argv[2] || 'Example'},{format});
 await writeFile('artifacts/order-guide/instagram-'+format+'.png',png);
}
