import Link from "next/link";
export default function Page(){return <main><section className="panel" style={{maxWidth:600,margin:"80px auto",textAlign:"center"}}><h1>Ödeme tamamlanamadı</h1><p>Kart işlemi tamamlanmadı. İsterseniz geri dönüp tekrar deneyebilir veya Havale/EFT seçeneğini kullanabilirsiniz.</p><Link className="primary" href="/">Geri dön</Link></section></main>}
