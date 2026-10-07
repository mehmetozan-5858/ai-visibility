"use client";
import {useEffect,useRef,useState} from "react";
import {readWorkWorkspace} from "../lib/work-workspace-view";
import {isBlockedWork,workBlocker,sortWorkBlockers} from "../lib/work-blockers";

const labels={
  "ready":"Hazır",
  "access-required":"Erişim bekliyor",
  "approval-required":"Müşteri onayı bekliyor",
  "in-progress":"Uygulanıyor",
  "completed":"Tamamlandı"
};

function CompletionForm({item,busy,onSave,onCancel,resolving=false}){
 const [detail,setDetail]=useState(''),[url,setUrl]=useState(''),[confirmed,setConfirmed]=useState(false);
 return <form className="panel" onSubmit={e=>{e.preventDefault();onSave({detail,url,confirmed})}}><h3>{item.clientName} · {item.title}</h3><label>{resolving?"Erişim/onay engeli nasıl giderildi?":"Yapılan iş ve kontrol sonucu"}<textarea required minLength={20} maxLength={4000} rows={5} value={detail} onChange={e=>setDetail(e.target.value)} placeholder={resolving?"Hangi erişim kontrol edildi veya hangi müşteri onayı alındı? Şifre yazmayın.":"Nerede ne uygulandı, sonucu nasıl kontrol ettiniz?"} style={{width:'100%',boxSizing:'border-box'}}/></label><label>Kanıt bağlantısı (isteğe bağlı)<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." maxLength={2000}/></label><label style={{display:'flex',gap:8,margin:'12px 0'}}><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{resolving?"Gereken erişimin/onayın sağlandığını kontrol ettim.":"Uygulamanın yapıldığını ve yukarıdaki sonucu kontrol ettiğimi doğruluyorum."}</label><small>{resolving?"Bu kayıt yalnız engeli kaldırır; görevi tamamlanmış saymaz. Şifre veya gizli anahtar eklemeyin.":"Bu kayıt yönetici doğrulamasıdır. Skor değişimi sonraki taramada ölçülür."}</small><div style={{display:'flex',gap:10,marginTop:12}}><button disabled={busy||!confirmed||detail.trim().length<20}>{resolving?"Engel giderildi, hazır olarak kaydet":"Kanıtı kaydet ve tamamla"}</button><button type="button" disabled={busy} onClick={onCancel}>Vazgeç</button></div></form>;
}
export default function WorkManager(){
  const [items,setItems]=useState([]),[busy,setBusy]=useState(""),[msg,setMsg]=useState(""),[deliveries,setDeliveries]=useState({}),[completion,setCompletion]=useState(null),[resolution,setResolution]=useState(null),[filter,setFilter]=useState("blocked"),[client,setClient]=useState("all"),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(""),[deliveryError,setDeliveryError]=useState("");
  const readRef=useRef(null),version=useRef(0),writeLock=useRef(false);
  async function load(){
    readRef.current?.abort();const controller=new AbortController();readRef.current=controller;const current=++version.current;
    const timeout=setTimeout(()=>controller.abort(),20000);
    setLoading(true);setLoadError("");setDeliveryError("");setItems([]);setDeliveries({});setCompletion(null);setResolution(null);
    try{const data=await readWorkWorkspace(fetch,controller.signal);if(current!==version.current)return;
      setItems(data.items);setDeliveries(data.deliveries);setDeliveryError(data.deliveryError);
    }catch(e){if(current===version.current){setItems([]);setDeliveries({});setLoadError(e.name==='AbortError'?"İş listesi zamanında yüklenemedi. Yeniden deneyin.":e.message)}}
    finally{clearTimeout(timeout);if(current===version.current)setLoading(false)}
  }
  useEffect(()=>{load();return()=>{version.current++;readRef.current?.abort()}},[]);
  async function setStatus(item,status,evidence){
    if(writeLock.current)return;writeLock.current=true;
    const id=item.id;
    setBusy(id);setMsg("");
    try{
      const r=await fetch("/api/work-items",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id,status,evidence,expectedStatus:item.status})});
      const d=await r.json();if(!r.ok){if(r.status===409)await load();throw new Error(d.error||"Güncellenemedi.");}
      setCompletion(null);setResolution(null);await load();
    }catch(e){setMsg(e.message)}finally{writeLock.current=false;setBusy("")}
  }
  async function reconcile(id){if(writeLock.current)return;writeLock.current=true;setBusy(id);setMsg('');try{const r=await fetch('/api/cms/drafts',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({workId:id})}),d=await r.json();if(!r.ok)throw Error(d.error);setMsg(d.status==='not-found-review-required'?'WordPress kaydı bulunamadı. Çift içerik oluşmaması için otomatik yeniden teslim yapılmadı.':d.published?'WordPress içeriği yayında görünüyor. Görevi tamamlamak için uygulama kanıtını ayrıca kaydedin.':d.status==='draft-created'?'WordPress taslağı bulundu ve teslim kaydı eşleştirildi.':'İçerik WordPress üzerinde inceleme veya yayın bekliyor.');await load()}catch(e){setMsg(e.message)}finally{writeLock.current=false;setBusy('')}}
  async function deliver(id){if(writeLock.current)return;writeLock.current=true;setBusy(id);setMsg("");try{const r=await fetch("/api/cms/drafts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workId:id,approved:true})});const d=await r.json();if(!r.ok)throw new Error(d.error);setMsg(d.status==="draft-created"?"WordPress taslağı oluşturuldu. Yayın için müşteri incelemesi gerekiyor.":"Önceki teslimi WordPress üzerinde kontrol edin.");await load()}catch(e){setMsg(e.message);await load()}finally{writeLock.current=false;setBusy("")}}
  const blocked=items.filter(isBlockedWork),clients=[...new Map(items.map(x=>[x.clientId,x.clientName])).entries()];
  const visible=sortWorkBlockers(items.filter(x=>(client==="all"||x.clientId===client)&&(filter==="all"||(filter==="blocked"?isBlockedWork(x):x.status===filter))));
  return <section className="panel work-workspace">
    <div className="section-title"><div><h2>Bekleyen İşler Merkezi</h2><small>Erişim, müşteri onayı ve uygulama görevleri</small></div></div>
    {loading||loadError?<p role="status">{loading?"İş sayıları yükleniyor…":"İş sayıları doğrulanamadı."}</p>:<div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}><span><b>{blocked.length}</b> bekleyen iş</span><span>{blocked.filter(x=>x.status==="access-required").length} erişim</span><span>{blocked.filter(x=>x.status==="approval-required").length} onay</span><span>{items.filter(x=>x.status==="ready").length} hazır</span></div>}
    <div className="scan-form" style={{marginBottom:16}}><label>İş durumu<select disabled={loading||!!busy} value={filter} onChange={e=>setFilter(e.target.value)}><option value="blocked">Erişim / onay bekleyen</option><option value="all">Tüm işler</option>{Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Müşteri<select disabled={loading||!!busy} value={client} onChange={e=>setClient(e.target.value)}><option value="all">Tüm müşteriler</option>{clients.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><button type="button" disabled={loading||!!busy} onClick={load}>{loading?"Yükleniyor…":"Yenile"}</button></div>
    <p style={{fontSize:13,opacity:.8}}>Ajanların hazırladığı işler burada izlenir. Müşteriden erişim veya onay gereken görevler, engelin giderildiği doğrulanana kadar bekler.</p>
    {loadError&&<p role="alert">{loadError}</p>}
    {deliveryError&&<p role="alert">Teslim kontrolü yüklenemedi: {deliveryError}. İş listesi görüntülenebilir; yeniden yükleyin.</p>}
    {items.length===200&&<p>En fazla 200 iş gösteriliyor.</p>}
    {resolution&&<CompletionForm key={resolution.id} item={resolution} resolving busy={!!busy} onCancel={()=>setResolution(null)} onSave={evidence=>setStatus(resolution,'ready',evidence)}/>}
    {msg&&<p className="client-message" role="status">{msg}</p>}
    {completion&&<CompletionForm key={completion.id} item={completion} busy={!!busy} onCancel={()=>setCompletion(null)} onSave={evidence=>setStatus(completion,'completed',evidence)}/>}
    {loading?<p role="status">İşler yükleniyor…</p>:loadError?null:!visible.length?<div className="empty">{items.length?"Bu filtrede iş bulunmuyor.":"Henüz uygulama görevi yok."}</div>:
    <div className="client-list">{visible.map(x=><article className="panel" key={x.id} style={{display:"grid",gap:12,marginBottom:12,overflowWrap:"anywhere"}}>
      <div className="client-avatar">{x.status==="completed"?"✓":"⚙"}</div>
      <div><b>{x.clientName} · {x.title}</b><small>{x.category}{x.detail?" · "+x.detail:""}</small></div>
      <span>{labels[x.status]||x.status}</span>
      {isBlockedWork(x)&&(()=>{const b=workBlocker(x);return <div style={{display:"grid",gap:10}}><small>{b.days===null?"Bekleme süresi bilinmiyor":`${b.days} gündür bekliyor`} · Gereken taraf: {b.owner}</small><div><b>Bekleme nedeni</b><p>{b.reason}</p></div><div><b>Gereken bilgi / erişim</b><p style={{whiteSpace:"pre-wrap"}}>{b.required}</p></div><div><b>Sonraki adım</b><p>{b.nextStep} Kontrol tamamlanınca aşağıdaki düğmeyle açıklama kaydedin.</p></div><button type="button" disabled={!!busy} onClick={()=>setResolution(x)}>Erişim / onay sağlandı</button></div>})()}

      {x.status==='completed'&&<details><summary>Uygulama kanıtı</summary><p style={{whiteSpace:'pre-wrap'}}>{x.completionEvidence||'Eski kayıt: uygulama kanıtı bulunmuyor.'}</p>{x.evidenceUrl&&<p>{x.evidenceUrl}</p>}<small>Yönetici kontrol kaydı · {x.evidenceRecordedAt?new Date(x.evidenceRecordedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'Tarih yok'}</small></details>}
      {deliveries[x.id]?.editUrl?<a href={deliveries[x.id].editUrl} target="_blank" rel="noopener noreferrer">WordPress taslağını incele</a>:deliveries[x.id]?<small>Teslim kontrolü gerekiyor</small>:x.status==="ready"&&/content|içerik|icerik|faq|soru|location|lokasyon/i.test(x.title)&&<button disabled={!!busy||!!deliveryError} onClick={()=>deliver(x.id)}>WordPress taslağı oluştur</button>}
      {deliveries[x.id]&&<button type="button" disabled={loading||!!busy||!!loadError} onClick={()=>reconcile(x.id)}>WordPress teslimini kontrol et</button>}
      <select value={x.status} disabled={loading||!!busy||!!loadError} aria-label={`${x.title} iş durumu`} onChange={e=>e.target.value==='completed'?setCompletion(x):isBlockedWork(x)&&['ready','in-progress'].includes(e.target.value)?setResolution(x):setStatus(x,e.target.value)} style={{background:"#071923",color:"#fff",border:"1px solid #24506a",borderRadius:10,padding:"9px"}}>
        <option value="ready">Hazır</option>
        <option value="approval-required">Müşteri onayı bekliyor</option>
        <option value="access-required">Erişim bekliyor</option>
        <option value="in-progress" disabled={isBlockedWork(x)}>Uygulanıyor</option>
        <option value="completed" disabled={x.status!=="in-progress"&&x.status!=="completed"}>Tamamlandı</option>
      </select>
    </article>)}</div>}
  </section>;
}
