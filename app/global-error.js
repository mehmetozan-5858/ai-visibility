"use client";
export default function GlobalError({reset}){
  return <html lang="tr"><body style={{margin:0,background:"#03131c",color:"#eef8ff",fontFamily:"Arial,sans-serif"}}>
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24}}>
      <section style={{maxWidth:560,width:"100%",border:"1px solid #1d4c63",borderRadius:18,padding:28,background:"#071e29",textAlign:"center"}}>
        <h1>Sistem geçici olarak yanıt veremiyor</h1>
        <p>Sayfayı yeniden yükleyin. Sorun devam ederse yönetim panelindeki Test Merkezi ile kontrolleri çalıştırın.</p>
        <button onClick={()=>reset()} style={{padding:"12px 18px",borderRadius:10}}>Yeniden dene</button>
      </section>
    </main>
  </body></html>;
}
