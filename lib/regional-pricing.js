const EUROPE_COUNTRIES=new Set([
  "europe","european union","eu","avrupa","avrupa birliği","avrupa birligi",
  "albania","andorra","austria","belarus","belgium","bosnia and herzegovina","bosnia","bulgaria","croatia","cyprus","czechia","czech republic","denmark","estonia","finland","france","germany","greece","hungary","iceland","ireland","italy","kosovo","latvia","liechtenstein","lithuania","luxembourg","malta","moldova","monaco","montenegro","netherlands","north macedonia","norway","poland","portugal","romania","san marino","serbia","slovakia","slovenia","spain","sweden","switzerland","ukraine","vatican city",
  "arnavutluk","andorra","avusturya","belarus","belçika","belcika","bosna hersek","bulgaristan","hırvatistan","hirvatistan","kıbrıs","kibris","çekya","cekya","çek cumhuriyeti","danimarka","estonya","finlandiya","fransa","almanya","yunanistan","macaristan","izlanda","irlanda","italya","kosova","letonya","lihtenştayn","litvanya","lüksemburg","luksemburg","malta","moldova","monako","karadağ","karadag","hollanda","kuzey makedonya","norveç","norvec","polonya","portekiz","romanya","san marino","sırbistan","sirbistan","slovakya","slovenya","ispanya","isveç","isvec","isviçre","isvicre","ukrayna","vatikan"
]);

function norm(value){return String(value||"").trim().toLocaleLowerCase("en-US")}
function envPrice(code,currency,kind,fallback){
  const key=`PRICE_${code.toUpperCase()}_${currency}_${kind.toUpperCase()}`;
  const n=Number(process.env[key]);
  return Number.isFinite(n)&&n>0?Math.round(n):fallback;
}

export function currencyForCountry(country){
  const c=norm(country);
  if(["türkiye","turkiye","turkey","tr"].includes(c))return "TRY";
  if(["united kingdom","uk","u.k.","great britain","britain","england","scotland","wales","northern ireland","birleşik krallık","birlesik krallik","ingiltere"].includes(c))return "GBP";
  if(["united states","united states of america","usa","u.s.a.","us","u.s.","america","amerika","abd"].includes(c))return "USD";
  if(EUROPE_COUNTRIES.has(c))return "EUR";
  return "USD";
}

const DEFAULTS={
  pro:{TRY:{setup:10000,monthly:6000},EUR:{setup:249,monthly:149},GBP:{setup:219,monthly:129},USD:{setup:269,monthly:159}},
  starter:{TRY:{setup:7500,monthly:4500},EUR:{setup:179,monthly:109},GBP:{setup:159,monthly:99},USD:{setup:199,monthly:119}},
  monitor:{TRY:{setup:5000,monthly:3000},EUR:{setup:119,monthly:69},GBP:{setup:99,monthly:59},USD:{setup:129,monthly:79}}
};

export function priceFor({score=0,country=""}={}){
  const currency=currencyForCountry(country);
  const code=Number(score)<=30?"pro":Number(score)<=55?"starter":"monitor";
  const names={pro:"Pro",starter:"Starter",monitor:"Takip"};
  const base=DEFAULTS[code][currency];
  const setupAmount=envPrice(code,currency,"setup",base.setup);
  const monthlyAmount=envPrice(code,currency,"monthly",base.monthly);
  return {code,name:names[code],currency,setupAmount,monthlyAmount,firstPayment:setupAmount+monthlyAmount,country:String(country||"")};
}

export function formatMoney(amount,currency,locale="tr-TR"){
  try{return new Intl.NumberFormat(locale,{style:"currency",currency,maximumFractionDigits:0}).format(Number(amount)||0)}catch{return `${Number(amount)||0} ${currency}`}
}
