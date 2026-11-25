import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {exportOrderGuideDraftPdf} from '../lib/order-guide-pdf.mjs';
test('German draft PDF exports one valid A4 page without confirmed details',async()=>{
 const bytes=await exportOrderGuideDraftPdf({brand:'Example'});
 assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');
 const doc=await PDFDocument.load(bytes);
 assert.equal(doc.getPageCount(),1);
 assert.deepEqual(doc.getPage(0).getSize(),{width:595,height:842});
});
test('invalid link fails before export',async()=>{
 await assert.rejects(exportOrderGuideDraftPdf({brand:'Example',whatsappUrl:'https://evil.example/123'}));
});
