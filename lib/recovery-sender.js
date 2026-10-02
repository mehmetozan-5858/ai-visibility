import crypto from "node:crypto";

export function recoveryStatus(){
  const email=process.env.ADMIN_RECOVERY_EMAIL||"";
  const phone=process.env.ADMIN_RECOVERY_PHONE||"";
  return {
    email:{configured:Boolean(email&&process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL),masked:maskEmail(email)},
    phone:{configured:Boolean(phone&&process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_FROM_NUMBER),masked:maskPhone(phone)}
  };
}
function maskEmail(v=""){
  const [a,b]=String(v).split("@");if(!a||!b)return "";
  return (a.slice(0,2)||"*")+"***@"+b;
}
function maskPhone(v=""){
  const s=String(v);return s?("******"+s.slice(-4)):"";
}
export async function sendRecoveryCode(channel,code){
  if(channel==="email"){
    const to=process.env.ADMIN_RECOVERY_EMAIL;
    if(!to||!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)throw new Error("email-not-configured");
    const r=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{"authorization":"Bearer "+process.env.RESEND_API_KEY,"content-type":"application/json"},
      body:JSON.stringify({
        from:process.env.RESEND_FROM_EMAIL,to:[to],
        subject:"AI Visibility şifre yenileme kodu",
        html:`<div style="font-family:Arial,sans-serif"><h2>AI Visibility</h2><p>Şifre yenileme kodunuz:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>Kod 10 dakika geçerlidir. Bu işlemi siz başlatmadıysanız kodu paylaşmayın.</p></div>`
      })
    });
    if(!r.ok)throw new Error("email-send-failed");
    return true;
  }
  if(channel==="phone"){
    const sid=process.env.TWILIO_ACCOUNT_SID,token=process.env.TWILIO_AUTH_TOKEN,to=process.env.ADMIN_RECOVERY_PHONE,from=process.env.TWILIO_FROM_NUMBER;
    if(!sid||!token||!to||!from)throw new Error("sms-not-configured");
    const form=new URLSearchParams({To:to,From:from,Body:`AI Visibility şifre yenileme kodunuz: ${code}. Kod 10 dakika geçerlidir.`});
    const auth=Buffer.from(sid+":"+token).toString("base64");
    const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,{
      method:"POST",headers:{"authorization":"Basic "+auth,"content-type":"application/x-www-form-urlencoded"},body:form
    });
    if(!r.ok)throw new Error("sms-send-failed");
    return true;
  }
  throw new Error("invalid-channel");
}
export function generateCode(){return String(crypto.randomInt(100000,1000000))}
