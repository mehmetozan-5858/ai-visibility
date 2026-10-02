"use client";
import {useEffect,useMemo,useState} from "react";

const CITIES=["Sivas","İstanbul","Ankara","İzmir","Bursa","Antalya","Kocaeli","Konya","Gaziantep","Kayseri","Adana","Mersin","Eskişehir","Samsun","Trabzon"];
const SECTORS=["Restoran / Kafe","Özel Sağlık / Klinik","Diş Kliniği","Güzellik / Bakım","Emlak","Otomotiv","Eğitim / Kurs","Mobilya / Ev Dekorasyon","Spor / Fitness","Hukuk / Muhasebe","Turizm / Otel","Ev Hizmetleri"];

export default function ProspectsManager(){
 const [rows,setRows]=useState([]),[msg,setMsg]=useState(""),[discovering,setDiscovering]=useState(false),[converting,setConverting]=useState("");
 const [city,setCity]=useState("Sivas"),[sector,setSector]=useState("Diş Kliniği"),[selectedId,setSelectedId]=useState(""),[searchResults,setSearchResults]=useState([]);

 async function load(){
   const r=await fetch("/api/prospects",{cache:"no-store"});
   const d=await r.json();
   setRows(d.prospects||[]);
 }

 useEffect(()=>{load()},[]);

 const selected=useMemo(()=>searchResults.find(x=>x.id===selectedId)||rows.find(x=>x.id===selectedId)||null,[searchResults,rows,selectedId]);

 async function discover(){
   setDiscovering(true);setMsg("");setSelectedId("");setSearchResults([]);
   try{
     const r=await fetch("/api/prospects/discover",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({city,sector})});
     const d=await r.json();
     if(!r.ok)throw new Error(d.error||"Keşif başarısız.");
     const found=d.prospects||[];
     setSearchResults(found);
     setMsg(`${city} · ${sector} için ${found.length} doğrulanabilir aday bulundu. Bir işletmeye dokunarak seç.`);
     await load();
   }catch(e){setMsg(e.message)}
   finally{setDiscovering(false)}
 }

 async function convertAndScan(id){
   setConverting(id);setMsg("");
   try{
     const r=await fetch(`/api/prospects/${id}/convert`,{method:"POST"});
     const d=await r.json();
     if(!r.ok)throw new Error(d.error||"Müşteriye dönüştürme başarısız.");
     setMsg(d.live
       ? `Müşteri hazır · ${(d.providers||[]).map(x=>`${x.name} ${x.score}/100`).join(" · ")} · Genel ${d.scan?.score??"—"}/100`
       : (d.note||"Müşteri oluşturuldu ve tarama kuyruğa alındı."));
     await load();
   }catch(e){setMsg(e.message)}
   finally{setConverting("")}
 }

 return <section className="panel">
   <div className="section-title">
     <div><h2>Potansiyel Müşteriler</h2><small>Şehir ve sektör seç · gerçek işletmeleri bul · listeden dokunarak seç</small></div>
   </div>

   <div className="client-form">
     <label>Şehir
       <select value={city} onChange={e=>setCity(e.target.value)} aria-label="Keşif şehri">
         {CITIES.map(x=><option key={x}>{x}</option>)}
       </select>
     </label>
     <label>Sektör
       <select value={sector} onChange={e=>setSector(e.target.value)} aria-label="Keşif sektörü">
         {SECTORS.map(x=><option key={x}>{x}</option>)}
       </select>
     </label>
     <button onClick={discover} disabled={discovering}>{discovering?"Adaylar bulunuyor…":`⌕ ${sector} adaylarını bul`}</button>
   </div>

   <p>Research ajanı yalnızca seçtiğin şehir ve sektörde gerçek, güncel işletmeleri arar. İşletme adı ve web sitesi elle girilmez.</p>
   {msg&&<p className="client-message">{msg}</p>}

   {searchResults.length>0&&<>
     <div style={{marginTop:14,marginBottom:8}}><b>Bulunan işletmeler</b><small style={{display:"block"}}>Bir karta dokun; seçilen işletme aşağıda hazır hale gelir.</small></div>
     <div className="client-list">
       {searchResults.map(x=>{
         const active=selectedId===x.id;
         return <article
           className="client-row prospect-row"
           key={x.id}
           onClick={()=>setSelectedId(x.id)}
           role="button"
           tabIndex={0}
           onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelectedId(x.id)}}}
           style={{cursor:"pointer",outline:active?"2px solid #36d8c3":"none"}}
         >
           <div className="client-avatar">{active?"✓":"⌕"}</div>
           <div><b>{x.name}</b><small>{[x.sector,x.city,x.domain].filter(Boolean).join(" · ")}</small></div>
           <span>{active?"Seçildi":"Seç"}</span>
         </article>
       })}
     </div>
   </>}

   {selected&&<div className="client-form" style={{marginTop:14}}>
     <div><b>{selected.name}</b><small style={{display:"block"}}>{[selected.sector,selected.city,selected.domain].filter(Boolean).join(" · ")}</small></div>
     <button onClick={()=>convertAndScan(selected.id)} disabled={converting===selected.id}>
       {converting===selected.id?"Hazırlanıyor…":selected.status==="converted"?"↻ Tekrar Tara":"＋ Seçileni müşteriye dönüştür + Tara"}
     </button>
   </div>}

   <div style={{marginTop:18}}><b>Aday havuzu</b><small style={{display:"block"}}>{rows.length} kayıtlı aday</small></div>
   {rows.length===0?<div className="empty">Henüz aday yok. Şehir ve sektör seçip ilk aramayı başlat.</div>:
   <div className="client-list">{rows.slice(0,20).map(x=><article className="client-row prospect-row" key={x.id}>
     <div className="client-avatar">⌕</div>
     <div><b>{x.name}</b><small>{[x.sector,x.city,x.domain].filter(Boolean).join(" · ")}</small></div>
     <span>{x.score==null?(x.scanStatus==="awaiting-provider"?"Kuyrukta":"Tarama bekliyor"):x.score+"/100"}</span>
   </article>)}</div>}
 </section>;
}
