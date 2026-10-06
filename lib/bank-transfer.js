export function validIban(value){
 const iban=String(value||"").replace(/\s/g,"").toUpperCase();
 if(!/^TR\d{24}$/.test(iban))return false;
 const digits=(iban.slice(4)+iban.slice(0,4)).replace(/[A-Z]/g,c=>String(c.charCodeAt(0)-55));
 return BigInt(digits)%97n===1n;
}

export function bankTransfer(currency,env=process.env){
 const code=String(currency||"").toUpperCase();
 if(!["TRY","USD","EUR","GBP"].includes(code))return null;
 const bankName=env.PAYMENT_BANK_NAME||"",accountHolder=env.PAYMENT_ACCOUNT_HOLDER||"";
 const iban=String(code==="TRY"?env.PAYMENT_IBAN:env[`PAYMENT_IBAN_${code}`]||"").replace(/\s/g,"").toUpperCase();
 const swift=code==="TRY"?"":String(env.PAYMENT_BANK_SWIFT||"").trim().toUpperCase();
 if(!bankName||!accountHolder||!validIban(iban)||(code!=="TRY"&&!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift)))return null;
 return {bankName,accountHolder,iban,currency:code,swift,chips:code==="USD"?env.PAYMENT_BANK_CHIPS||"":""};
}
