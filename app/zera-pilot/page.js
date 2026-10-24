import {createPilot} from '../../pilot/zera-pilot.mjs';
import {buildAuditQueue} from '../../pilot/zera-audit-queue.mjs';
import {buildPilotReport,resolveReportLanguage} from '../../pilot/zera-report.mjs';
export const metadata={title:'ZERA Pilot | AI Visibility'};
export const dynamic='force-static';
export default function ZeraPilotPage(){
 const pilot=createPilot();
 const report=buildPilotReport(buildAuditQueue(pilot),{asOf:'2026-10-24'});
 const card={border:'1px solid #d1d5db',padding:'16px',borderRadius:'12px',marginBottom:'12px'};
 return <main style={{maxWidth:880,margin:'36px auto',padding:20,fontFamily:'Arial,sans-serif',lineHeight:1.55}}>
  <p style={{fontSize:12,letterSpacing:2}}>AI VISIBILITY / PILOT 001</p>
  <h1>ZERA Clothing — Wetzlar</h1>
  <p>Customer report default: <strong>{resolveReportLanguage({country:pilot.country})==='en'?'English':'Türkçe'}</strong>. Owner may choose Turkish or English independently.</p>
  <p><strong>Consent:</strong> public-information analysis approved. Private accounts, order data, and changes to business profiles are not authorized.</p>
  <section style={card}><h2>Audit status</h2><p><strong>{report.progress.completed} of {report.progress.total}</strong> provider audits verified.</p><p>Live scan provider is not configured for this pilot; no test or example output is displayed as a result.</p></section>
  <section style={card}><h2>Starting reference</h2><p>Instagram: {pilot.baseline.instagramFollowers.toLocaleString('tr-TR')} followers, {pilot.baseline.instagramPosts} posts (owner-provided screenshot dated {pilot.baseline.asOf}; not API verified).</p><p>Company-owned website: not yet confirmed. Search branding ambiguity: exploratory research lead, not a measured sales loss.</p></section>
  <section style={card}><h2>Provider scan queue</h2><ul>{buildAuditQueue(pilot).map(t=><li key={t.id}><strong>{t.channel}</strong> / {t.locale}: {t.query} — <em>awaiting verified scan</em></li>)}</ul></section>
  <section style={card}><h2>Outcome measurement</h2><p>Verified attributable orders: not connected. Revenue: unknown. An unknown value must never be reported as zero.</p><p>Final customer report: not ready. English is the default for this German customer; Turkish is available for owner review.</p></section>
  <p style={{fontSize:12,color:'#666'}}>This view is a pilot preparation interface, not evidence that agents are running. No emails, charges or third-party API calls are made by this page.</p>
 </main>;
}
