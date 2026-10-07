"use client";
import {useEffect,useMemo,useState} from "react";

const LOCATIONS={
  "Türkiye":["Sivas","İstanbul","Ankara","İzmir","Bursa","Antalya","Kocaeli","Konya","Gaziantep","Kayseri","Adana","Mersin","Eskişehir","Samsun","Trabzon"],
  "Almanya":["Berlin","Hamburg","Münih","Köln","Frankfurt","Düsseldorf","Stuttgart","Dortmund"],
  "İngiltere":["Londra","Manchester","Birmingham","Liverpool","Leeds","Bristol","Edinburgh","Glasgow"],
  "Fransa":["Paris","Lyon","Marsilya","Nice","Toulouse","Bordeaux","Lille","Strasbourg"],
  "İtalya":["Roma","Milano","Napoli","Torino","Floransa","Bologna","Venedik"],
  "İspanya":["Madrid","Barcelona","Valencia","Sevilla","Malaga","Bilbao"],
  "Hollanda":["Amsterdam","Rotterdam","Lahey","Utrecht","Eindhoven"],
  "Belçika":["Brüksel","Antwerp","Gent","Brugge"],
  "Avusturya":["Viyana","Salzburg","Graz","Linz"],
  "İsviçre":["Zürih","Cenevre","Basel","Bern","Lozan"],
  "ABD":["New York","Los Angeles","Chicago","Miami","Houston","San Francisco","Boston","Seattle"],
  "Kanada":["Toronto","Vancouver","Montreal","Calgary","Ottawa"],
  "BAE":["Dubai","Abu Dhabi","Sharjah"],
  "Suudi Arabistan":["Riyad","Cidde","Dammam"],
  "Katar":["Doha"]
};
const SECTORS=["Restoran / Kafe","Özel Sağlık / Klinik","Diş Kliniği","Güzellik / Bakım","Emlak","Otomotiv","Eğitim / Kurs","Mobilya / Ev Dekorasyon","Spor / Fitness","Hukuk / Muhasebe","Turizm / Otel","Ev Hizmetleri","Tekstil / Giyim"];

export default function ProspectsManager(){
 const [rows,setRows]=useState([]),[msg,setMsg]=useState(""),[discovering,setDiscovering]=useState(false),[converting,setConverting]=useState("");
 const [country,setCountry]=useState("Türkiye"),[city,setCity]=useState("Sivas"),[sector,setSector]=useState("Diş Kliniği"),[selectedId,setSelectedId]=useState(""),[searchResults,setSearchResults]=useState([]);
 const [customCity,setCustomCity]=useState("");

 async function load(){
   const r=await fetch("/api/prospects",{cache:"no-store"});
   const d=await r.json();
   setRows(d.prospects||[]);
 }

 useEffect(()=>{load()},[]);
 useEffect(()=>{
   const first=LOCATIONS[country]?.[0]||"";
   setCity(first);
   setCustomCity("");
   setSelectedId("");
   setSearchResults([]);
 },[country]);

 const effectiveCity=customCity.trim()||city;
 const selected=useMemo(()=>searchResults.find(x=>x.id===selectedId)||rows.find(x=>x.id===selectedId)||null,[searchResults,rows,selectedId]);
 const visibleRows=useMemo(()=>rows.filter(x=>
   String(x.country||"Türkiye").toLocaleLowerCase("tr-TR")===country.toLocaleLowerCase("tr-TR") &&
   String(x.city||"").toLocaleLowerCase("tr-TR")===effectiveCity.toLocaleLowerCase("tr-TR") &&
   String(x.sector||"").toLocaleLowerCase("tr-TR")===sector.toLocaleLowerCase("tr-TR")
 ),[rows,country,effectiveCity,sector]);

 async function discover(){
   setDiscovering(true);setMsg("");setSelectedId("");setSearchResults([]);
   try{
     const r=await fetch("/api/prospects/discover",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({country,city:effectiveCity,sector})});
     const d=await r.json();
     if(!r.ok)throw new Error(d.error||"Keşif başarısız.");
     const found=d.prospects||[];
     setSearchResults(found);
     setMsg(`${country} · ${effectiveCity} · ${sector} için ${found.length} doğrulanabilir aday bulundu. Bir işletmeye dokunarak seç.`);
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
     <div><h2>Potansiyel Müşteriler</h2><small>Ülke → şehir → sektör seç · gerçek işletmeleri bul · listeden dokunarak seç</small></div>
   </div>

   <div className="client-form">
     <label>Ülke
       <select value={country} onChange={e=>setCountry(e.target.value)} aria-label="Keşif ülkesi">
         {Object.keys(LOCATIONS).map(x=><option key={x}>{x}</option>)}
       </select>
     </label>

     <label>Şehir
       <select value={city} onChange={e=>{setCity(e.target.value);setCustomCity("")}} aria-label="Keşif şehri">
         {(LOCATIONS[country]||[]).map(x=><option key={x}>{x}</option>)}
       </select>
     </label>

     <label>Listede olmayan şehir
       <input value={customCity} onChange={e=>setCustomCity(e.target.value)} placeholder="Örn. Köln yakınında Bonn"/>
     </label>

     <label>Sektör / Meslek dalı
       <select value={sector} onChange={e=>setSector(e.target.value)} aria-label="Keşif sektörü">
         {SECTORS.map(x=><option key={x}>{x}</option>)}
       </select>
     </label>

     <button onClick={discover} disabled={discovering||!effectiveCity}>{discovering?"Adaylar bulunuyor…":`⌕ ${effectiveCity} · ${sector} adaylarını bul`}</button>
   </div>

   <p>Research ajanı yalnızca seçtiğin ülke, şehir ve sektörde gerçek, güncel işletmeleri arar. Listede olmayan şehirleri de elle yazabilirsin; işletme adı ve web sitesi elle girilmez.</p>
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
           <div><b>{x.name}</b><small>{[x.sector,x.city,x.country,x.domain].filter(Boolean).join(" · ")}</small></div>
           <span>{active?"Seçildi":"Seç"}</span>
         </article>
       })}
     </div>
   </>}

   {selected&&<div className="client-form" style={{marginTop:14}}>
     <div><b>{selected.name}</b><small style={{display:"block"}}>{[selected.sector,selected.city,selected.country,selected.domain].filter(Boolean).join(" · ")}</small></div>
     <button onClick={()=>convertAndScan(selected.id)} disabled={converting===selected.id}>
       {converting===selected.id?"Hazırlanıyor…":selected.status==="converted"?"↻ Tekrar Tara":"＋ Seçileni müşteriye dönüştür + Tara"}
     </button>
   </div>}

   <div style={{marginTop:18}}><b>{country} · {effectiveCity} · {sector} adayları</b><small style={{display:"block"}}>{visibleRows.length} eşleşen kayıt</small></div>
   {visibleRows.length===0?<div className="empty">Bu konum ve sektörde henüz kayıt yok. Yukarıdan “Adayları bul” ile arama başlat.</div>:
   <div className="client-list">{visibleRows.slice(0,20).map(x=><article className="client-row prospect-row" key={x.id}>
     <div className="client-avatar">⌕</div>
     <div><b>{x.name}</b><small>{[x.sector,x.city,x.country,x.domain].filter(Boolean).join(" · ")}</small></div>
     <span>{x.score==null?(x.scanStatus==="awaiting-provider"?"Kuyrukta":"Tarama bekliyor"):"Sağlayıcı tahmini: "+x.score+"/100"}</span>
   </article>)}</div>}
 </section>;
}
