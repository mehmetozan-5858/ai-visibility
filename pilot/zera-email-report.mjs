import {buildPilotReport,formatPilotReportMarkdown} from './zera-report.mjs';
/** Produces a draft only. Delivery requires separate verified mail transport and owner approval. */
export function prepareZeraEmailReport(records,{approvedForSending=false,recipient='info@ze-ra.de'}={}){
 if(approvedForSending!==false)throw new Error('Sending belongs to separately approved transport');
 if(recipient!=='info@ze-ra.de')throw new Error('Unexpected pilot recipient');
 const report=buildPilotReport(records);
 const complete=report.progress.completed===7;
 const subject=complete?'AI Visibility – ZERA Clothing: Ergebnisbericht':'AI Visibility – ZERA Clothing: Zwischenstand der Analyse';
 const body=['Guten Tag, liebes ZERA Clothing Team,','',
 'vielen Dank für Ihre Teilnahme an unserem kostenlosen Pilotprojekt.',
 complete?'Die öffentliche Sichtbarkeitsanalyse ist abgeschlossen.':'Die Analyse der öffentlich zugänglichen Informationen ist noch nicht abgeschlossen.',
 'Wir unterscheiden ausdrücklich zwischen verifizierten Ergebnissen und offenen Prüfpunkten.','',
 formatPilotReportMarkdown(report),'',
 'Wir nehmen ohne gesonderte Zustimmung keine Änderungen an Ihren Konten oder privaten Daten vor.',
 'Mit freundlichen Grüßen','Mehmet Ozan Ekmekci','AI Visibility'].join('\n');
 return {recipient,subject,body,status:'draft_requires_review',sent:false,
  reportComplete:complete,verifiedTaskCount:report.progress.completed,
  readyForFinalReport:complete};
}
