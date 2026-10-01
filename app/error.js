"use client";
export default function Error({error,reset}){
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24}}>
    <section className="panel" style={{maxWidth:560,width:"100%",textAlign:"center"}}>
      <div style={{fontSize:42,marginBottom:10}}>!</div>
      <h1>Bir şey ters gitti</h1>
      <p>İşlem tamamlanamadı. Verileriniz silinmedi. Tekrar deneyebilir veya ana sayfaya dönebilirsiniz.</p>
      {error?.digest&&<small>Hata kodu: {error.digest}</small>}
      <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginTop:18}}>
        <button onClick={()=>reset()}>Tekrar dene</button>
        <button onClick={()=>{window.location.href="/"}}>Ana sayfa</button>
      </div>
    </section>
  </main>;
}
