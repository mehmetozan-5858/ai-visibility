import Link from 'next/link';
import AgentControlConsole from '../../../components/AgentControlConsole';
export const metadata={title:'Ar-Ge ve Ajan Denetimi',robots:{index:false,follow:false}};
export default function Page(){return <main style={{maxWidth:980,margin:'auto',padding:'28px 20px 90px'}}>
 <h1>Ar-Ge ve Ortak Ajan Denetimi</h1><p>AI Visibility Works · Global Broker · Future Signal</p>
 <p><Link href="/admin/lansman-kontrol">Canlı kabul merkezine dön</Link></p><AgentControlConsole/>
 </main>;}
