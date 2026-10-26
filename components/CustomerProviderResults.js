'use client';
import {useEffect,useState} from 'react';
const card={background:'#0b1d2a',border:'1px solid #183f54',borderRadius:22,padding:18,minWidth:0,overflowWrap:'anywhere'};
const copy={
 tr:{title:'Yapay zekâ yanıtları',note:'Kaydedilmiş asistan yanıtlarını ve kaynaklarını burada görebilirsiniz. Bu kayıtlar tek başına görünürlük skoru oluşturmaz.',
 loading:'Yanıtlar yükleniyor…',error:'Yanıtlar şu anda yüklenemedi. Lütfen daha sonra tekrar deneyin.',empty:'Henüz kaydedilmiş yanıt yok.',source:'Yanıtın kaynağı',supported:'Kaynak desteği var',
 states:{'not-configured':'Erişim hazırlanıyor','provider-execution-paused':'Tarama etkinleştirilmedi','source-supported-answer':'Kaynaklı yanıt','answer-received-unverified':'Doğrulanmamış yanıt','empty-answer':'Boş yanıt',failed:'Yanıt alınamadı','invalid-result':'Sonuç inceleniyor'}},
 en:{title:'AI assistant answers',note:'View recorded assistant answers and their sources. These records alone do not establish a visibility score.',
 loading:'Loading answers…',error:'Answers could not be loaded. Please try again later.',empty:'No recorded answers yet.',source:'Answer source',supported:'Source support available',
 states:{'not-configured':'Access being prepared','provider-execution-paused':'Scanning is not enabled','source-supported-answer':'Source-supported answer','answer-received-unverified':'Unverified answer','empty-answer':'Empty answer',failed:'No answer received','invalid-result':'Result under review'}}
};
const names={gemini:'Gemini',openai:'OpenAI',perplexity:'Perplexity'};
export default function CustomerProviderResults({lang='tr'}){
 const c=copy[lang]||copy.tr;
 const [state,setState]=useState({loading:true,error:false,items:[]});
 useEffect(()=>{
  const controller=new AbortController();setState({loading:true,error:false,items:[]});
  fetch('/api/client-provider-results',{cache:'no-store',credentials:'same-origin',headers:{'accept-language':lang},signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error('results-unavailable');const data=await response.json();
    if(!Array.isArray(data.comparisons))throw Error('invalid-results');return data.comparisons;})
   .then(items=>{if(!controller.signal.aborted)setState({loading:false,error:false,items});})
   .catch(()=>{if(!controller.signal.aborted)setState({loading:false,error:true,items:[]});});
  return()=>controller.abort();
 },[lang]);
 return <section style={card} aria-label={c.title} data-localized="true">
  <h3 style={{margin:'0 0 8px'}}>{c.title}</h3><p style={{color:'#a6bac7',fontSize:13,lineHeight:1.6}}>{c.note}</p>
  {state.loading?<p role="status">{c.loading}</p>:state.error?<p role="alert">{c.error}</p>:!state.items.length?<p>{c.empty}</p>:
   <div style={{display:'grid',gap:12}}>{state.items.map(item=>{
    const date=new Date(item.createdAt);return <article key={item.id} style={{background:'#0c2230',borderRadius:14,padding:14,minWidth:0}}>
     <h4 style={{margin:'0 0 6px'}}>{item.query}</h4>
     {Number.isFinite(date.getTime())?<time dateTime={date.toISOString()} style={{fontSize:12,color:'#89a2b2'}}>{date.toLocaleString(lang==='en'?'en-US':'tr-TR')}</time>:null}
     <div style={{display:'grid',gap:10,marginTop:12}}>{(item.results||[]).map(result=><div key={result.provider}>
      <strong>{names[result.provider]||result.provider}</strong><span style={{display:'block',fontSize:12,color:'#a6bac7',marginTop:4}}>{c.states[result.status]||c.states['invalid-result']}</span>
      {result.answer?<p style={{whiteSpace:'pre-wrap',lineHeight:1.6,fontSize:13}}>{result.answer}</p>:null}
      {result.verified===true?<small style={{display:'block',marginBottom:5}}>{c.supported}</small>:null}
      {result.sourceUrl?<a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:13}}>{c.source}</a>:null}
     </div>)}</div>
    </article>;
   })}</div>}
 </section>;
}
