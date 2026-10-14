const EUROPE_COUNTRIES=new Set([
  "europe","european union","eu","avrupa","avrupa birliği","avrupa birligi",
  "albania","andorra","austria","belarus","belgium","bosnia and herzegovina","bosnia","bulgaria","croatia","cyprus","czechia","czech republic","denmark","estonia","finland","france","germany","greece","hungary","iceland","ireland","italy","kosovo","latvia","liechtenstein","lithuania","luxembourg","malta","moldova","monaco","montenegro","netherlands","north macedonia","norway","poland","portugal","romania","san marino","serbia","slovakia","slovenia","spain","sweden","switzerland","ukraine","vatican city",
  "arnavutluk","andorra","avusturya","belarus","belçika","belcika","bosna hersek","bulgaristan","hırvatistan","hirvatistan","kıbrıs","kibris","çekya","cekya","çek cumhuriyeti","danimarka","estonya","finlandiya","fransa","almanya","yunanistan","macaristan","izlanda","irlanda","italya","kosova","letonya","lihtenştayn","litvanya","lüksemburg","luksemburg","malta","moldova","monako","karadağ","karadag","hollanda","kuzey makedonya","norveç","norvec","polonya","portekiz","romanya","san marino","sırbistan","sirbistan","slovakya","slovenya","ispanya","isveç","isvec","isviçre","isvicre","ukrayna","vatikan"
]);

function norm(value){return String(value||"").trim().toLocaleLowerCase("en-US")}
function envPrice(key,currency,fallback){
  const n=Number(process.env[`PRICE_${key.toUpperCase().replace(/-/g,"_")}_${currency}`]);
  return Number.isFinite(n)&&n>=0?Math.round(n):fallback;
}

export function currencyForCountry(country){
  const c=norm(country);
  if(["türkiye","turkiye","turkey","tr"].includes(c))return "TRY";
  if(["united kingdom","uk","u.k.","great britain","britain","england","scotland","wales","northern ireland","birleşik krallık","birlesik krallik","ingiltere"].includes(c))return "GBP";
  if(["united states","united states of america","usa","u.s.a.","us","u.s.","america","amerika","abd"].includes(c))return "USD";
  if(EUROPE_COUNTRIES.has(c))return "EUR";
  return "USD";
}

const PRICES={
  "business-diagnosis":{kind:"one-time",tr:"İşletme – Sorun Tespit + Rapor",en:"Business – Diagnosis + Report",TRY:4990,EUR:119,GBP:99,USD:129},
  "business-solution":{kind:"from",tr:"İşletme – Çözüm Başlangıç Paketi",en:"Business – Solution Implementation",TRY:19900,EUR:449,GBP:399,USD:499},
  "business-monitoring":{kind:"monthly",tr:"İşletme – Sürekli Takip + Optimizasyon",en:"Business – Continuous Monitoring + Optimization",TRY:6990,EUR:159,GBP:139,USD:169},
  "social-analysis-1":{kind:"one-time",tr:"Sosyal Medya – 1 Platform Analiz + Rapor",en:"Social Media – 1 Platform Analysis + Report",TRY:3990,EUR:99,GBP:89,USD:109},
  "social-analysis-2-3":{kind:"one-time",tr:"Sosyal Medya – 2–3 Platform Analiz + Rapor",en:"Social Media – 2–3 Platform Analysis + Report",TRY:6990,EUR:169,GBP:149,USD:179},
  "social-analysis-4plus":{kind:"one-time",tr:"Sosyal Medya – 4+ Platform Analiz + Rapor",en:"Social Media – 4+ Platform Analysis + Report",TRY:9990,EUR:239,GBP:209,USD:259},
  "social-solution":{kind:"from",tr:"Sosyal Medya – Çözüm / Uygulama",en:"Social Media – Solution / Implementation",TRY:14900,EUR:349,GBP:299,USD:399},
  "social-monitoring-1":{kind:"monthly",tr:"Sosyal Medya – Sürekli Takip 1 Platform",en:"Social Media – Continuous Monitoring, 1 Platform",TRY:4990,EUR:119,GBP:99,USD:129},
  "social-monitoring-2-3":{kind:"monthly",tr:"Sosyal Medya – Sürekli Takip 2–3 Platform",en:"Social Media – Continuous Monitoring, 2–3 Platforms",TRY:7990,EUR:189,GBP:169,USD:199},
  "social-monitoring-4plus":{kind:"monthly",tr:"Sosyal Medya – Sürekli Takip 4+ Platform",en:"Social Media – Continuous Monitoring, 4+ Platforms",TRY:11900,EUR:279,GBP:249,USD:299}
};

export const SERVICE_CODES=Object.freeze(Object.keys(PRICES));
export const BUNDLE_DISCOUNT_RANGE=Object.freeze({min:10,max:15});

export function servicePrice({service="business-diagnosis",country="",language="tr"}={}){
  const currency=currencyForCountry(country);
  const code=SERVICE_CODES.includes(service)?service:"business-diagnosis";
  const row=PRICES[code];
  const amount=envPrice(code,currency,row[currency]);
  const isMonthly=row.kind==="monthly";
  return {
    code,
    name:language==="en"?row.en:row.tr,
    currency,
    kind:row.kind,
    setupAmount:isMonthly?0:amount,
    monthlyAmount:isMonthly?amount:0,
    firstPayment:amount,
    amount,
    country:String(country||"")
  };
}

export function pricingCatalog({country="",language="tr"}={}){
  return SERVICE_CODES.map(code=>servicePrice({service:code,country,language}));
}

// Legacy compatibility for older screens. New payment flows should use servicePrice/pricingCatalog.
export function priceFor({score=0,country=""}={}){
  const code=Number(score)<=30?"business-solution":Number(score)<=55?"business-diagnosis":"business-monitoring";
  return servicePrice({service:code,country,language:"tr"});
}

export function formatMoney(amount,currency,locale="tr-TR"){
  try{return new Intl.NumberFormat(locale,{style:"currency",currency,maximumFractionDigits:0}).format(Number(amount)||0)}catch{return `${Number(amount)||0} ${currency}`}
}
