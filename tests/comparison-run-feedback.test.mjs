import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonRunFeedback,comparisonHistoryFeedback} from '../lib/comparison-run-feedback.mjs';
test('provider failure is not misreported as a database save failure',()=>{
 const message=comparisonRunFeedback({results:[{status:'provider-failed'}]});
 assert.match(message,/kayıt aşamasına geçilmedi/);
 assert.doesNotMatch(message,/kaydı tamamlanamadı/);
 assert.match(comparisonRunFeedback({results:[{status:'error',failureStage:'comparison-storage'}]}),/kaydı tamamlanamadı/);
 assert.match(comparisonRunFeedback({providerCallsStarted:0},false),/çağrısı başlatılmadı/);
});
test('partial completion and legacy missing reasons are explicit without claiming a completed scan',()=>{
 assert.match(comparisonRunFeedback({results:[{status:'stored'},{status:'provider-failed'}]}),/1 AI yanıtı kaydedildi.*Bazı görevler başarısız/);
 const legacy=comparisonHistoryFeedback({attempts:[{status:'provider-failed'}]});
 assert.match(legacy,/sağlayıcı aşamasında/);assert.match(legacy,/mevcut durum yanıtında bulunmuyor/);
 assert.match(comparisonHistoryFeedback({attempts:[{status:'started'}]}),/yeni çağrı başlatılmadı/);
});
test('raw database/provider messages and untrusted task IDs never reach customer feedback',()=>{
 const data={error:'SECRET password raw SQL',summary:'SECRET token',results:[{status:'error',reason:'SECRET answer'}],attempts:[{status:'error',taskId:'SECRET customer'}]};
 for(const text of [comparisonRunFeedback(data),comparisonRunFeedback(data,false),comparisonHistoryFeedback(data)])assert.doesNotMatch(text,/SECRET|password|SQL|token/);
});
