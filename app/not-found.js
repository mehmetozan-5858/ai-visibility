import Link from "next/link";
export default function NotFound(){
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24}}>
    <section className="panel" style={{maxWidth:560,width:"100%",textAlign:"center"}}>
      <h1>Sayfa bulunamadı</h1>
      <p>Bu bağlantı kaldırılmış, süresi dolmuş veya yanlış olabilir.</p>
      <Link href="/">Ana sayfaya dön</Link>
    </section>
  </main>;
}
