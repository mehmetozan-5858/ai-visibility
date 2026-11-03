import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isAutomaticReply} from '../lib/inbound-auto-reply.mjs';

test('real EGE-like auto reply is not human interest',()=>{
 assert.equal(isAutomaticReply({subject:'Auto-reply from EGE Endustriyel Kontrol AS'}),true);
 assert.equal(isAutomaticReply({subject:'Re: AI Visibility Works',headers:{'auto-submitted':'auto-replied'}}),true);
});
test('genuine questions and no header remain human candidates',()=>{
 assert.equal(isAutomaticReply({subject:'Re: your AI visibility proposal'}),false);
 assert.equal(isAutomaticReply({subject:'Re: your AI visibility proposal',headers:{'auto-submitted':'no'}}),false);
 assert.equal(isAutomaticReply({subject:'Re: your AI visibility proposal',headers:{'x-auto-response-suppress':'All'}}),false);
});
test('automatic response receives human review and does not mark a sales reply',async()=>{
 const source=await readFile(new URL('../lib/inbound-mail.js',import.meta.url),'utf8');
 assert.match(source,/const automated=!reason&&isAutomaticReply\(email\)/);
 assert.match(source,/if\(automated && match\)/);
 assert.match(source,/follow_up_at=NULL,reply_needs_human=TRUE/);
 assert.match(source,/reason='automatic-response'/);
 assert.ok(source.indexOf("if(automated && match)")<source.indexOf("if(!reason){\n     if(match.type==='business')"));
});
