"use client";
import {useEffect,useMemo,useState} from "react";

const severityLabel={critical:"Kritik",high:"Yüksek",medium:"Orta",low:"Düşük"};
const statusLabel={open:"Açık",requested:"Talep edildi",offered:"Teklif hazır",approved:"Onaylandı","in-progress":"Uygulanıyor",resolved:"Çözüldü",draft:"Hazırlanıyor",accepted:"Kabul edildi",paid:"Ödendi",completed:"Tamamlandı",cancelled:"İptal edildi"};
const tabs=[
  ["overview","Genel Bakış","⌂"],
  ["findings","Bulgu ve Çözümler","◆"],
  ["work","Çalışmalar","⚙"],
  ["scans","Taramalar","◎"],
  ["payments","Ödemeler","₺"]
];

const shell={display:"grid",gap:14};
const card={background:"linear-gradient(145deg,#0b1d2a,#091722)",border:"1px solid #183f54",borderRadius:22,padding:18,boxShadow:"0 14px 35px #00000024"};
const soft={background:"#0c2230",border:"1px solid #1d4a61",borderRadius:16,padding:14};
const muted={color:"#89a2b2",fontSize:12};
const title={margin:"0 0 6px",fontSize:20};

function StatusPill({text,tone="blue"}){
  const map={blue:["#123956","#77b9ff"],green:["#0d4236","#68e3bd"],orange:["#4a3315","#ffc474"],red:["#4a2227","#ff9aa8"],gray:["#25333d","#b3c1ca"]};
  const [bg,color]=map[tone]||map.blue;
  return <span style={{background:bg,color,border:`1px solid ${color}44`,borderRadius:999,padding:"5px 9px",fontSize:11,fontWeight:800,whiteSpace:"nowrap"}}>{text}</span>;
}

function Metric({label,value,sub,icon,tone="blue"}){
  const glow=tone==="green"?"#26d7ad":tone==="orange"?"#f4a94e":tone==="purple"?"#9a7bff":"#4a9dff";
  return <div style={{...soft,minHeight:118,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",right:-18,top:-18,width:70,height:70,borderRadius:"50%",background:glow,opacity:.08}}/>
    <div style={{fontSize:22,marginBottom:10}}>{icon}</div>
    <div style={muted}>{label}</div>
    <strong style={{display:"block",fontSize:25,margin:"4px 0 2px"}}>{value}</strong>
    {sub&&<small style={{color:glow}}>{sub}</small>}
  </div>;
}

export default function CustomerPortal(){
  const [account,setAccount]=useState(null),[findings,setFindings]=useState([]),[msg,setMsg]=useState(""),[busy,setBusy]=useState(""),[tab,setTab]=useState("overview");
  async function load(){
    try{
      const [a,f]=await Promise.all([
        fetch("/api/client-portal",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Panel yüklenemedi.");return d}),
        fetch("/api/client-portal/solutions",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Çözümler yüklenemedi.");return d})
      ]);
      setAccount(a.account);setFindings(f.findings||[]);
    }catch(e){setMsg(e.message)}
  }
  useEffect(()=>{load()},[]);
  const completed=useMemo(()=>account?.scans?.filter(x=>x.status==="completed"&&Number.isFinite(Number(x.score)))||[],[account]);
  const latest=completed[0]||null;
  const previous=completed[1]||null;
  const delta=latest&&previous?Number(latest.score)-Number(previous.score):null;
  const critical=findings.filter(x=>x.severity==="critical"||x.severity==="high").length;
  const activeWork=(account?.workItems||[]).filter(x=>!["completed","resolved","cancelled"].includes(String(x.status||"").toLowerCase())).length;
  const paidCount=(account?.payments||[]).filter(x=>String(x.status||"").toLowerCase()==="paid").length;

  async function requestSolution(id){
    setBusy(id);setMsg("");
    try{
      const r=await fetch("/api/client-portal/solutions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({findingId:id})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Talep gönderilemedi.");
      setMsg(d.message||"Çözüm talebiniz alındı.");await load();
    }catch(e){setMsg(e.message)}finally{setBusy("")}
  }
  if(msg&&!account)return <section className="panel"><p className="client-message">{msg}</p></section>;
  if(!account)return <section className="panel"><p>Müşteri paneli yükleniyor…</p></section>;

  return <section style={shell}>
    {msg&&<article style={{...card,borderColor:"#246c72"}}><p className="client-message" style={{margin:0}}>{msg}</p></article>}

    <article style={{...card,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:15}}>
        <div>
          <div style={{...muted,textTransform:"uppercase",letterSpacing:".12em"}}>Müşteri Paneli</div>
          <h2 style={{margin:"5px 0 3px",fontSize:24}}>{account.client.name}</h2>
          <div style={muted}>{account.client.domain}</div>
        </div>
        <StatusPill text={account.client.plan||"Paket yok"} tone="green"/>
      </div>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:3}}>
        {tabs.map(([id,label,icon])=><button key={id} onClick={()=>setTab(id)} aria-pressed={tab===id} style={{whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:7,borderRadius:14,padding:"10px 13px",background:tab===id?"linear-gradient(90deg,#367cff,#22cfa4)":"#102735",border:tab===id?"1px solid #58b9ff":"1px solid #21465a",color:"white",opacity:tab===id?1:.75,boxShadow:tab===id?"0 8px 24px #247ecb33":"none"}}><span>{icon}</span>{label}</button>)}
      </div>
    </article>

    {tab==="overview"&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:10}}>
        <Metric label="AI görünürlük" value={latest?.score==null?"—":latest.score+"/100"} sub={delta==null?"İlk ölçüm":delta>0?`+${delta} puan artış`:delta<0?`${delta} puan değişim`:"Değişim yok"} icon="◎" tone={delta!=null&&delta>0?"green":"blue"}/>
        <Metric label="Kritik / yüksek bulgu" value={critical} sub={critical?"Öncelikli aksiyon gerekli":"Kritik bulgu yok"} icon="◆" tone={critical?"orange":"green"}/>
        <Metric label="Aktif çalışma" value={activeWork} sub="Devam eden işler" icon="⚙" tone="purple"/>
        <Metric label="Tamamlanan tarama" value={completed.length} sub={latest?new Date(latest.completedAt||latest.createdAt).toLocaleDateString("tr-TR"):"Henüz tarama yok"} icon="◉"/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12}}>
        <article style={card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><h3 style={title}>Son durum</h3><StatusPill text={latest?"Güncel":"Veri bekleniyor"} tone={latest?"green":"gray"}/></div>
          <div style={{display:"grid",gap:10}}>
            <div style={soft}><div style={muted}>Son skor</div><strong style={{fontSize:30}}>{latest?.score==null?"—":latest.score+"/100"}</strong></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={soft}><div style={muted}>Bulgu</div><strong style={{fontSize:22}}>{findings.length}</strong></div>
              <div style={soft}><div style={muted}>Ödenen kayıt</div><strong style={{fontSize:22}}>{paidCount}</strong></div>
            </div>
          </div>
        </article>

        <article style={card}>
          <h3 style={title}>Hızlı işlemler</h3>
          <p style={{...muted,marginTop:0}}>İlgili alana doğrudan geç.</p>
          <div style={{display:"grid",gap:9}}>
            {[["findings","Bulgu ve çözümleri incele",`${findings.length} kayıt`],["work","Çalışmaları takip et",`${(account.workItems||[]).length} kayıt`],["scans","Tarama geçmişini aç",`${completed.length} tarama`],["payments","Ödeme geçmişini gör",`${(account.payments||[]).length} kayıt`]].map(([id,label,count])=><button key={id} onClick={()=>setTab(id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:"#102735",border:"1px solid #21465a"}}><span>{label}</span><small>{count} ›</small></button>)}
          </div>
        </article>
      </div>
    </>}

    {tab==="findings"&&<article style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}><div><h3 style={title}>Bulgu ve Çözümler</h3><p style={{...muted,margin:0}}>Sorunlar, önem seviyesi ve uygulanabilir çözüm teklifleri.</p></div><StatusPill text={`${findings.length} kayıt`} tone="blue"/></div>
      {!findings.length?<div className="empty"><b>Henüz bulgu yok.</b><br/><span style={muted}>Yeni bir tarama tamamlandığında bulgular otomatik olarak burada listelenecek.</span></div>:
      <div style={{display:"grid",gap:11}}>{findings.slice(0,30).map(x=>{
        const tone=x.severity==="critical"?"red":x.severity==="high"?"orange":x.severity==="medium"?"blue":"gray";
        const done=x.status==="resolved";
        const requested=x.status==="requested"||x.offerStatus==="requested";
        return <article key={x.id} style={{...soft,borderLeft:`4px solid ${tone==="red"?"#ff6f82":tone==="orange"?"#f4a94e":tone==="blue"?"#4a9dff":"#6f8796"}`}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}><div><b style={{fontSize:16}}>{x.title}</b><div style={{display:"flex",gap:7,marginTop:7,flexWrap:"wrap"}}><StatusPill text={severityLabel[x.severity]||x.severity} tone={tone}/><StatusPill text={x.provider||"AI"} tone="gray"/></div></div><strong style={{fontSize:14}}>{x.price>0?Number(x.price).toLocaleString("tr-TR")+" "+x.currency:(statusLabel[x.offerStatus]||"Fiyat hazırlanıyor")}</strong></div>
          {x.detail&&<p style={{color:"#a6bac7",lineHeight:1.5,fontSize:13}}>{x.detail}</p>}
          <div style={{background:"#091923",borderRadius:12,padding:11,marginTop:10}}><div style={muted}>Önerilen çözüm</div><b style={{display:"block",marginTop:4}}>{x.solutionTitle||"AI görünürlük iyileştirmesi"}</b>{x.deliverable&&<small style={{...muted,display:"block",marginTop:5}}>{x.deliverable}</small>}</div>
          <div style={{marginTop:11,display:"flex",justifyContent:"flex-end"}}>{requested?<StatusPill text="Talep edildi" tone="green"/>:done?<StatusPill text="Çözüldü" tone="green"/>:<button disabled={busy===x.id} onClick={()=>requestSolution(x.id)}>{busy===x.id?"Gönderiliyor…":"Çözümü istiyorum"}</button>}</div>
        </article>})}</div>}
    </article>}

    {tab==="work"&&<article style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}><div><h3 style={title}>Çalışmalar</h3><p style={{...muted,margin:0}}>Onaylanan işlerin uygulama sürecini buradan takip edebilirsin.</p></div><StatusPill text={`${(account.workItems||[]).length} kayıt`} tone="purple"/></div>
      {(account.workItems||[]).length===0?<div className="empty"><b>Henüz çalışma kaydı yok.</b><br/><span style={muted}>Bir çözüm onaylandığında süreç burada Bekliyor → Hazırlanıyor → Uygulanıyor → Tamamlandı şeklinde görünür.</span></div>:
      <div style={{display:"grid",gap:10}}>{account.workItems.slice(0,20).map(x=><div style={soft} key={x.id}><div style={{display:"flex",justifyContent:"space-between",gap:10}}><div><b>{x.title}</b><small style={{...muted,display:"block",marginTop:5}}>{x.category||"Çalışma"}</small></div><StatusPill text={statusLabel[x.status]||x.status} tone={x.status==="completed"?"green":x.status==="in-progress"?"orange":"blue"}/></div>{x.detail&&<p style={{...muted,lineHeight:1.5}}>{x.detail}</p>}<div style={{height:6,borderRadius:99,background:"#153444",overflow:"hidden",marginTop:11}}><div style={{height:"100%",width:x.status==="completed"?"100%":x.status==="in-progress"?"70%":x.status==="approved"?"45%":"20%",background:"linear-gradient(90deg,#3d86ff,#2ad1aa)"}}/></div></div>)}</div>}
    </article>}

    {tab==="scans"&&<article style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}><div><h3 style={title}>Tarama Geçmişi</h3><p style={{...muted,margin:0}}>AI görünürlük skorunun zaman içindeki değişimini izle.</p></div><StatusPill text={`${completed.length} tarama`} tone="blue"/></div>
      {completed.length===0?<div className="empty"><b>Henüz tamamlanmış tarama yok.</b><br/><span style={muted}>İlk tarama tamamlandığında skor geçmişi burada görünür.</span></div>:
      <div style={{display:"grid",gap:10}}>{completed.slice(0,10).map((x,i)=>{const prev=completed[i+1];const d=prev?Number(x.score)-Number(prev.score):null;return <div key={x.id} style={{...soft,display:"grid",gridTemplateColumns:"auto 1fr auto",gap:12,alignItems:"center"}}><div style={{width:54,height:54,borderRadius:"50%",display:"grid",placeItems:"center",background:"radial-gradient(circle,#155f87,#0a2637)",border:"1px solid #2f779a"}}><strong>{x.score}</strong></div><div><b>{new Date(x.completedAt||x.createdAt).toLocaleDateString("tr-TR")}</b><small style={{...muted,display:"block",marginTop:4}}>{new Date(x.completedAt||x.createdAt).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}</small></div><StatusPill text={d==null?"İlk ölçüm":d>0?`+${d} puan`:d<0?`${d} puan`:"Değişmedi"} tone={d>0?"green":d<0?"red":"gray"}/></div>})}</div>}
    </article>}

    {tab==="payments"&&<article style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}><div><h3 style={title}>Ödemeler</h3><p style={{...muted,margin:0}}>Paket, tutar ve ödeme durumlarını görüntüle.</p></div><StatusPill text={`${(account.payments||[]).length} kayıt`} tone="green"/></div>
      {(account.payments||[]).length===0?<div className="empty"><b>Ödeme kaydı yok.</b><br/><span style={muted}>Ödeme oluştuğunda paket ve durum bilgisi burada listelenecek.</span></div>:
      <div style={{display:"grid",gap:10}}>{account.payments.slice(0,10).map(x=>{const total=Number(x.setupAmount||0)+Number(x.monthlyAmount||0);return <div style={{...soft,display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}} key={x.id}><div><b>{x.plan||"Paket"}</b><small style={{...muted,display:"block",marginTop:4}}>{x.createdAt?new Date(x.createdAt).toLocaleDateString("tr-TR"):"Tarih yok"}</small></div><div style={{textAlign:"right"}}><strong style={{display:"block"}}>{total.toLocaleString("tr-TR")} TL</strong><div style={{marginTop:5}}><StatusPill text={statusLabel[x.status]||x.status} tone={String(x.status).toLowerCase()==="paid"?"green":"orange"}/></div></div></div>})}</div>}
    </article>}
  </section>;
}
