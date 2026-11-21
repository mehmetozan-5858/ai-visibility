import ZeraFirstCustomerTrial from '../../../../components/ZeraFirstCustomerTrial';
import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {verifyClientToken} from '../../../../lib/admin-auth';
import {getDatabaseUrl} from '../../../../lib/db';
import {databasePool} from '../../../../lib/database-runtime';
import {buildZeraChannelReport,hasZeraChannelReportAccess} from '../../../../lib/zera-channel-report.mjs';

export const dynamic = 'force-dynamic';
export const metadata = {title:'ZERA Kanal Raporu',robots:{index:false,follow:false},referrer:'no-referrer'};

export default async function Page({searchParams}) {
  const store = await cookies();
  const session = await verifyClientToken(store.get('ai_client')?.value || '');
  const pilotId = process.env.ZERA_CHANNEL_REPORT_CLIENT_ID;
  if (!session?.clientId || session.clientId !== pilotId) notFound();

  let allowed = false;
  try {
    allowed = await hasZeraChannelReportAccess(databasePool(getDatabaseUrl()), session.clientId, pilotId);
  } catch {
    // Missing pilot storage or credentials leave the report inaccessible.
  }
  if (!allowed) notFound();

  const report = buildZeraChannelReport((await searchParams).profil);
  return <main>
    <a href="/musteri-panel">Müşteri paneli</a>
    <h1>ZERA · Dijital kanal raporu</h1>
    <p>Test müşterisi. Bu ekran tarihli açık kanıt kayıtlarından rapor üretir. Kaynakların güncelliği ayrıca doğrulanır.</p>
    <form method="get" action="/musteri-panel/rapor/zera">
      <label htmlFor="profil">ZERA Instagram profili</label>{' '}
      <input id="profil" name="profil" type="url" required defaultValue={report?.profileUrl || ''}/>{' '}
      <button type="submit">Raporu göster</button>
    </form>
    {!report && <p>Raporu açmak için ZERA’nın Instagram profil adresini girin.</p>}
    {report?.findings.map(item => <details key={item.id}>
      <summary>{item.title} · {item.status}</summary>
      <p>{item.observation}</p>
      <p><strong>Kaynak tarihi</strong> {item.date}</p>
      {item.source.type === 'instagram'
        ? <a href={item.source.url} rel="noreferrer">Instagram profili</a>
        : <ul aria-label="Örnek açık web sorguları">{item.source.queries.map(query => <li key={query}>{query}</li>)}</ul>}
      <p><strong>Onay sonrası istenecek bilgi</strong> {item.request}</p>
      <p><strong>Sonraki doğrulama</strong> {item.next}</p>
    </details>)}
    {report && <ZeraFirstCustomerTrial findings={report.findings}/>}
  </main>;
}
