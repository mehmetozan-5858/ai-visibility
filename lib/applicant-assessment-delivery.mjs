/**
 * Single-attempt delivery of a 15-minute applicant-only preview grant.
 * Deliberately no automatic retry. Provider errors and bearer links are never logged.
 */
export const applicantDeliveryEnabled=()=>process.env.APPLICANT_ASSESSMENT_DELIVERY_ENABLED==="true";
export function applicantAssessmentLink(token,{base=process.env.PUBLIC_APP_URL||"https://www.aivisibilityworks.com"}={}){
 if(typeof token!=="string"||!/^[a-z0-9-]+\.[0-9a-f-]+\.[0-9a-f-]+\.[0-9]{10,12}\.[A-Za-z0-9_-]{43}$/i.test(token))throw Error("invalid-assessment-token");
 const url=new URL(base);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash)throw Error("invalid-public-app-url");
 return url.origin+"/basvuru-analiz#token="+encodeURIComponent(token);
}
export async function sendApplicantAssessmentLink({email,link,send=fetch}={}){
 if(typeof email!=="string"||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof link!=="string"||!link.startsWith("https://")||!link.includes("/basvuru-analiz#token="))throw Error("invalid-delivery");
 const apiKey=process.env.RESEND_API_KEY,from=process.env.EMAIL_FROM||process.env.RESEND_FROM_EMAIL;
 if(!apiKey||!from)throw Error("email-provider-not-configured");
 let response;
 try{
  response=await send("https://api.resend.com/emails",{
   method:"POST",
   headers:{"authorization":"Bearer "+apiKey,"content-type":"application/json"},
   body:JSON.stringify({from,to:[email],
    subject:"AI Visibility Works — Ücretsiz analiz bağlantınız / Your free assessment",
    text:"Ücretsiz AI ön değerlendirme bağlantınız / Your free AI assessment:\n"+link+
     "\n\nBu bağlantı 15 dakika geçerlidir. Yalnızca isteğiniz doğrulandıysa kullanın.\n"+
     "Valid for 15 minutes. If you did not request this, please ignore this message."})
  });
 }catch{throw Error("delivery-provider-unconfirmed")}
 if(!response?.ok)throw Error("delivery-provider-unconfirmed");
 return true;
}
