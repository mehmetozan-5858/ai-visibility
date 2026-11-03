// Strictly identify machine replies. Redirect addresses are suggestions for human review,
// never a reason to contact a new address without separate verification.
export function isAutomaticReply(message={}) {
 const subject=String(message.subject||'').trim();
 const headers=message.headers||{};
 const header=(name)=>String(headers[name]||headers[name.toLowerCase()]||headers[name.toUpperCase()]||'').trim().toLowerCase();
 const auto=header('auto-submitted');
 if(auto && auto!=='no')return true;
 if(/\b(auto[- ]?reply|automatic reply|automated response|out of office|out-of-office|absence notification|abwesenheitsnotiz|otomatik yanıt|otomatik cevap)\b/i.test(subject))return true;
 if(header('x-autoreply') || header('x-autorespond') || header('x-auto-response-suppress'))return true;
 return false;
}
