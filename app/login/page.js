import LoginForm from "../../components/LoginForm";
import {getDatabaseUrl} from "../../lib/db";
export const metadata={title:"Giriş | AI Visibility"};
export default function Page(){
  if(process.env.VERCEL_ENV==="preview" && !getDatabaseUrl())
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
