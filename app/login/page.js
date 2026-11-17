import LoginForm from "../../components/LoginForm";
import {getDatabaseUrl} from "../../lib/db";
import {headers} from "next/headers";
export const metadata={title:"Giriş | AI Visibility"};
// Preview/Production environment must be evaluated per request, not prerendered at build.
export const dynamic = "force-dynamic";
export default async function Page(){
  const h=await headers();
  const host=(h.get("x-forwarded-host")||h.get("host")||"").toLowerCase().split(":")[0];
  // Vercel branch preview hosts must never inherit a Production login form.
  const previewHost=host.endsWith(".vercel.app");
  if((previewHost && !process.env.ZERA_PREVIEW_DATABASE_URL) || (process.env.VERCEL_ENV==="preview" && !getDatabaseUrl()))
    return <main style={{maxWidth:600,margin:"64px auto",padding:"24px"}}>
      <section className="panel">
        <h1>Önizleme: yönetici girişi kapalı</h1>
        <p>Bu önizlemede ayrı test veritabanı doğrulanmadığı için giriş işlemi güvenlik nedeniyle kapatılmıştır.</p>
        <p>Mevcut yönetici şifreniz değişmedi. Canlı yönetici paneline yalnızca resmi alan adından giriş yapın.</p>
        <a href="https://www.aivisibilityworks.com/login">Canlı yönetici girişine git</a>
      </section>
    </main>;
  return <main><LoginForm/></main>;
}
