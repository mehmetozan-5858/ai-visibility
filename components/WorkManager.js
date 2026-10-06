"use client";
import {useEffect,useState} from "react";

const labels={
  "ready":"Hazır",
  "access-required":"Erişim bekliyor",
  "approval-required":"Müşteri onayı bekliyor",
  "in-progress":"Uygulanıyor",
  "completed":"Tamamlandı"
};

function CompletionForm({item,busy,onSave,onCancel}){
 const [detail,setDetail]=useState(''),[url,setUrl]=useState(''),[confirmed,setConfirmed]=useState(false);
 return <form className="panel" onSubmit={e=>{e.preventDefault();onSave({detail,url,confirmed})}}><h3>{item.clientName} · {item.title}</h3><label>Yapılan iş ve kontrol sonucu<textarea required minLength={20} maxLength={4000} rows={5} value={detail} onChange={e=>setDetail(e.target.value)} placeholder="Nerede ne uygulandı, sonucu nasıl kontrol ettiniz?" style={{width:'100%',boxSizing:'border-box'}}/></label><label>Kanıt bağlantısı (isteğe bağlı)<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." maxLength={2000}/></label><label style={{display:'flex',gap:8,margin:'12px 0'}}><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Uygulamanın yapıldığını ve yukarıdaki sonucu kontrol ettiğimi doğruluyorum.</label><small>Bu kayıt yönetici doğrulamasıdır. Skor değişimi sonraki taramada ölçülür.</small><div style={{display:'flex',gap:10,marginTop:12}}><button disabled={busy||!confirmed||detail.trim().length<20}>Kanıtı kaydet ve tamamla</button><button type="button" disabled={busy} onClick={onCancel}>Vazgeç</button></div></form>;
}
export default function WorkManager(){
  const [items,setItems]=useState([]),[busy,setBusy]=useState(""),[msg,setMsg]=useState(""),[deliveries,setDeliveries]=useState({}),[completion,setCompletion]=useState(null);
  async function load(){
    const r=await fetch("/api/work-items",{cache:"no-store"}),d=await r.json();
    if(r.ok)setItems(d.items||[]);
    const cr=await fetch("/api/cms/drafts",{cache:"no-store"}),cd=await cr.json();if(cr.ok)setDeliveries(Object.fromEntries((cd.deliveries||[]).map(x=>[x.workId,x])));
  }
  useEffect(()=>{load()},[]);
  async function setStatus(item,status,evidence){
    const id=item.id;
    setBusy(id);setMsg("");
    try{
      const r=await fetch("/api/work-items",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id,status,evidence,expectedStatus:item.status})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Güncellenemedi.");
      setCompletion(null);await load();
    }catch(e){setMsg(e.message)}finally{setBusy("")}
  }
  async function reconcile(id){setBusy(id);setMsg('');try{const r=await fetch('/api/cms/drafts',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({workId:id})}),d=await r.json();if(!r.ok)throw Error(d.error);setMsg(d.status==='not-found-review-required'?'WordPress kaydı bulunamadı. Çift içerik oluşmaması için otomatik yeniden teslim yapılmadı.':d.published?'WordPress içeriği yayında görünüyor. Görevi tamamlamak için uygulama kanıtını ayrıca kaydedin.':d.status==='draft-created'?'WordPress taslağı bulundu ve teslim kaydı eşleştirildi.':'İçerik WordPress üzerinde inceleme veya yayın bekliyor.');await load()}catch(e){setMsg(e.message)}finally{setBusy('')}}
  async function deliver(id){setBusy(id);setMsg("");try{const r=await fetch("/api/cms/drafts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workId:id,approved:true})});const d=await r.json();if(!r.ok)throw new Error(d.error);setMsg(d.status==="draft-created"?"WordPress taslağı oluşturuldu. Yayın için müşteri incelemesi gerekiyor.":"Önceki teslimi WordPress üzerinde kontrol edin.");await load()}catch(e){setMsg(e.message);await load()}finally{setBusy("")}}
  return <section className="panel">
    <div className="section-title"><div><h2>İş ve Onay Merkezi</h2><small>Uygulama Ajanı görevlerinin gerçek durumu</small></div></div>
    {msg&&<p className="client-message" role="status">{msg}</p>}
    {completion&&<CompletionForm key={completion.id} item={completion} busy={busy===completion.id} onCancel={()=>setCompletion(null)} onSave={evidence=>setStatus(completion,'completed',evidence)}/>}
    {!items.length?<div className="empty">Henüz uygulama görevi yok. Raporlar → Uygulama Ajanı → Eksikleri uygula ile oluşturabilirsiniz.</div>:
    <div className="client-list">{items.map(x=><article className="client-row" key={x.id}>
      <div className="client-avatar">{x.status==="completed"?"✓":"⚙"}</div>
      <div><b>{x.clientName} · {x.title}</b><small>{x.category}{x.detail?" · "+x.detail:""}</small></div>
      <span>{labels[x.status]||x.status}</span>
      {x.status==='completed'&&<details><summary>Uygulama kanıtı</summary><p style={{whiteSpace:'pre-wrap'}}>{x.completionEvidence||'Eski kayıt: uygulama kanıtı bulunmuyor.'}</p>{x.evidenceUrl&&<p>{x.evidenceUrl}</p>}<small>Yönetici kontrol kaydı · {x.evidenceRecordedAt?new Date(x.evidenceRecordedAt).toLocaleString('tr-TR'):'Tarih yok'}</small></details>}
      {deliveries[x.id]?.editUrl?<a href={deliveries[x.id].editUrl} target="_blank" rel="noopener noreferrer">WordPress taslağını incele</a>:deliveries[x.id]?<small>Teslim kontrolü gerekiyor</small>:x.status==="ready"&&/content|içerik|icerik|faq|soru|location|lokasyon/i.test(x.title)&&<button disabled={busy===x.id} onClick={()=>deliver(x.id)}>WordPress taslağı oluştur</button>}
      {deliveries[x.id]&&<button type="button" disabled={busy===x.id} onClick={()=>reconcile(x.id)}>WordPress teslimini kontrol et</button>}
      <select value={x.status} disabled={busy===x.id} onChange={e=>e.target.value==='completed'?setCompletion(x):setStatus(x,e.target.value)} style={{background:"#071923",color:"#fff",border:"1px solid #24506a",borderRadius:10,padding:"9px"}}>
        <option value="ready">Hazır</option>
        <option value="approval-required">Müşteri onayı bekliyor</option>
        <option value="access-required">Erişim bekliyor</option>
        <option value="in-progress">Uygulanıyor</option>
        <option value="completed" disabled={x.status!=="in-progress"&&x.status!=="completed"}>Tamamlandı</option>
      </select>
    </article>)}</div>}
  </section>;
}
