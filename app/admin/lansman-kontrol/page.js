import Link from "next/link";
import LaunchQAConsole from "../../../components/LaunchQAConsole";

export const metadata={title:"Lansman Kontrolü",robots:{index:false,follow:false,nocache:true}};

export default function Page(){
  return <main style={{minHeight:"100vh",padding:"28px 20px 70px",background:"linear-gradient(180deg,#03121c,#061722)"}}>
    <div style={{maxWidth:980,margin:"0 auto"}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:24,flexWrap:"wrap"}}>
        <div><div style={{fontSize:11,letterSpacing:".18em",fontWeight:900,color:"#54dfd0",textTransform:"uppercase"}}>AI Visibility Admin</div><h1 style={{margin:"6px 0 0"}}>Lansman Kontrol Merkezi</h1></div>
        <Link href="/admin">← Yönetim paneline dön</Link>
      </header>
      <LaunchQAConsole/>
    </div>
  </main>;
}
