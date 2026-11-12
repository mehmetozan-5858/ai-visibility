"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useLanguage} from './LanguageProvider';
import LeadEmailVerification from './LeadEmailVerification';
import {applicantEmailResumeId} from '../lib/applicant-email-resume.mjs';

export default function ApplicantEmailResume(){
 const {lang}=useLanguage(),en=lang==='en';
 const [leadId,setLeadId]=useState(null),[loaded,setLoaded]=useState(false),[email,setEmail]=useState(''),[selectedEmail,setSelectedEmail]=useState('');
 useEffect(()=>{
  const id=applicantEmailResumeId(window.location.hash,window.history.state);
  setLeadId(id);setLoaded(true);
  // Remove the reference from the displayed URL after parsing.
  // History state retains only the reference across refresh; never email, OTP or a token.
  if(id)window.history.replaceState({...window.history.state,aivApplicantLead:id},'',window.location.pathname+window.location.search);
 },[]);
 return <section style={{maxWidth:680,margin:'32px auto',padding:20}}>
  <Link href="/">AI Visibility Works</Link>
  <h1>{en?'Continue email verification':'E-posta doğrulamasına devam et'}</h1>
  {!loaded?<p role="status">{en?'Loading…':'Yükleniyor…'}</p>:!leadId?<>
   <p role="alert">{en?'Open the verification link from your saved application. This page cannot look up an account.':'Kaydedilen başvurundaki doğrulama bağlantısını aç. Bu sayfada hesap araması yapılmaz.'}</p>
   <Link href="/yeni-musteri">{en?'Application page':'Başvuru sayfası'}</Link>
  </>:<>
   <p>{en?'Use the email address on your existing application. This does not create another application, change your password or activate paid access.':'Mevcut başvurunda kullandığın e-posta adresini gir. Bu işlem yeni başvuru oluşturmaz, şifreni değiştirmez veya ücretli erişim açmaz.'}</p>
   <form className="client-form" onSubmit={event=>{event.preventDefault();setSelectedEmail(email.trim().toLowerCase())}}>
    <label>{en?'Application email':'Başvuru e-postası'}<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>{setEmail(event.target.value);setSelectedEmail('')}} style={{fontSize:18,minHeight:48}}/></label>
    <button type="submit">{en?'Continue':'Devam et'}</button>
   </form>
   {selectedEmail&&<LeadEmailVerification key={leadId+selectedEmail} leadId={leadId} email={selectedEmail} language={en?'en':'tr'}/>}
  </>}
 </section>;
}
