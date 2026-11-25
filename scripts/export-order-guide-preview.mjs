import {mkdir,writeFile} from 'node:fs/promises';
import {exportOrderGuideDraftPdf} from '../lib/order-guide-pdf.mjs';
await mkdir('artifacts/order-guide',{recursive:true});
const bytes=await exportOrderGuideDraftPdf({brand:process.argv[2] || 'Example'});
await writeFile('artifacts/order-guide/bestellanleitung-entwurf.pdf',bytes);
