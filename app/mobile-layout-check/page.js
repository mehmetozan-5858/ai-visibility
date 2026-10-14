import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default function Page(){if(process.env.VERCEL_ENV!=='preview')notFound();return <main><h1>Authenticated mobile layout check</h1><p>Read-only preview at 390×844. No test, payment or outreach actions are automatically run.</p><iframe title="Settings at mobile width" src="/ayarlar" width="390" height="844" style={{maxWidth:'100%',border:'1px solid #24506a'}}/></main>}
