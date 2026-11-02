// Safe, price-free introductory outreach renderer. No sending side effects.
const templates = {
  en: {
    subject: 'Is {{company}} visible in AI recommendations?',
    body: 'Hi {{greeting}},\n\nWhen someone asks ChatGPT or another AI assistant to recommend businesses in {{industry}}, does {{company}} appear?\n\nAt AI Visibility Works, we help businesses understand how they show up in AI-generated recommendations and where they may be able to improve.\n\nWould you be interested in a complimentary initial check based on publicly available information? We can share a short summary of what we observe and possible next steps.\n\nNo payment, subscription or obligation is required for this initial check.\n\nBest regards,\nAI Visibility Works\nhttps://www.aivisibilityworks.com',
  },
  tr: {
    subject: '{{company}} yapay zekâ önerilerinde görünüyor mu?',
    body: 'Merhaba {{greeting}},\n\nBir müşteri ChatGPT veya başka bir yapay zekâ asistanından {{industry}} sektöründe firma önerisi istediğinde {{company}} sonuçlarda yer alıyor mu?\n\nAI Visibility Works olarak işletmelerin yapay zekâ yanıtlarındaki görünürlüğünü anlamalarına ve geliştirilebilecek alanları belirlemelerine yardımcı oluyoruz.\n\nHerkese açık bilgilerle ücretsiz bir ön kontrol yapmamızı ister misiniz? Gördüğümüz bulguları ve olası sonraki adımları kısa bir özetle paylaşabiliriz.\n\nBu ilk kontrol için ödeme, abonelik veya taahhüt gerekmiyor.\n\nSaygılarımızla,\nAI Visibility Works\nhttps://www.aivisibilityworks.com',
  },
};
function clean(value, max) {
  if (typeof value !== 'string') throw new TypeError('Missing personalization value');
  const v = value.trim();
  if (!v || v.length > max || /[\r\n<>]/.test(v) || /\{\{|\}\}/.test(v)) throw new TypeError('Unsafe personalization value');
  return v;
}
export function renderIntroOutreach({ language, company, industry, firstName, approved = false, lawfulBasisVerified = false, suppressionChecked = false } = {}) {
  if (!approved || !lawfulBasisVerified || !suppressionChecked) throw new Error('OUTREACH_NOT_APPROVED');
  const tpl = templates[language];
  if (!tpl) throw new TypeError('Unsupported language');
  const fields = {
    company: clean(company, 100),
    industry: clean(industry, 100),
    greeting: firstName ? clean(firstName, 80) : (language === 'tr' ? 'yetkili' : 'there'),
  };
  const fill = text => text.replace(/\{\{(company|industry|greeting)\}\}/g, (_, key) => fields[key]);
  return Object.freeze({ subject: fill(tpl.subject), text: fill(tpl.body) });
}
