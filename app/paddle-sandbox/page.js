import {cookies} from 'next/headers';
import {verifyClientToken} from '../../lib/admin-auth';
import {notFound} from 'next/navigation';
import {sandboxEnabled,sandboxClientToken,sandboxCatalog} from '../../lib/paddle-sandbox';
import SandboxCheckout from '../../components/SandboxCheckout';
export const dynamic='force-dynamic';
export default async function Page(){
 if(!sandboxEnabled())notFound();
 const store=await cookies();const session=await verifyClientToken(store.get('ai_client')?.value||'');
 return <main style={{maxWidth:1000,margin:'40px auto',padding:24}}><h1>AI Visibility — Paddle Sandbox</h1><p>Yalnızca test ortamı. Gerçek tahsilat yapılmaz; müşteri erişimi değiştirilmez.</p><SandboxCheckout linked={Boolean(session)} token={sandboxClientToken()} catalogs={Object.fromEntries(['TRY','USD','EUR','GBP'].map(c=>[c,sandboxCatalog(c)]))}/></main>;
}
