/**
 * Evidence-only launch gates for the real AI Visibility Works customer journey.
 * Pure policy: no DB calls, emails, provider calls, checkout or account creation.
 * Inputs must be resolved by trusted server-side services, never client JSON.
 * A lead, a prospect, an internal "paid" flag and a sample score are NOT release evidence.
 */
const validId = x => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x);
const fail = (stage,reason) => ({stage,ready:false,reason});
const pass = (stage) => ({stage,ready:true,reason:"verified"});

export function evaluateCustomerJourney({
  lead, emailVerification, assessment, account, payment, settlementEvidence
}={}) {
  const application = validId(lead?.id) && ["new","contacted","qualified","proposal","won"].includes(lead?.status)
    ? pass("application") : fail("application","verified-application-required");
  const email = application.ready && emailVerification?.verified === true &&
    emailVerification?.leadId === lead.id && emailVerification?.email === lead.email
    ? pass("email") : fail("email","verified-email-ownership-required");

  // Scores are grounded in eligible provider observations, not demo/default numbers.
  const evidence = email.ready && assessment?.status === "ready" &&
    assessment?.prospectId && assessment?.leadId === lead.id &&
    assessment?.source === "verified-observations" &&
    assessment?.score !== null && Number.isInteger(assessment?.score) &&
    assessment.score >= 0 && assessment.score <= 100 &&
    assessment?.samples >= 6 && assessment?.providers >= 2 && assessment?.queries >= 2
    ? pass("assessment") : fail("assessment","verified-measurement-required");

  // A database label 'paid' is insufficient: require independently trusted settlement.
  const owner = validId(account?.clientId) && account?.leadId === lead?.id;
  const linked = owner && payment?.clientId === account.clientId &&
    payment?.status === "paid" && payment?.id && settlementEvidence?.paymentId === payment.id;
  const paddle = linked && payment?.method === "paddle" &&
    settlementEvidence?.provider === "paddle" &&
    settlementEvidence?.signed === true &&
    settlementEvidence?.eventType === "transaction.completed" &&
    settlementEvidence?.tenantLinked === true &&
    settlementEvidence?.amountMatched === true &&
    settlementEvidence?.reversed !== true;
  const bank = linked && payment?.method === "bank-transfer" &&
    settlementEvidence?.provider === "bank" &&
    settlementEvidence?.reconciled === true &&
    settlementEvidence?.reversed !== true;
  const settlement = paddle || bank ? pass("settlement") : fail("settlement","independent-payment-confirmation-required");

  const access = owner && account?.access?.allowed === true &&
    ((account.access.kind === "paid" && settlement.ready) ||
      (account.access.kind === "pilot" && account.access.approved === true &&
       account.access.expired !== true && account.access.revoked !== true))
    ? pass("access") : fail("access","trusted-active-entitlement-required");

  const results = access.ready && evidence.ready && account?.report?.tenantId === account.clientId &&
    account.report?.verified === true && account.report?.visible === true
    ? pass("results") : fail("results","tenant-scoped-verified-report-required");

  return Object.freeze({application,email,assessment:evidence,settlement,access,results,
    productionReady:[application,email,evidence,access,results].every(x=>x.ready) &&
      (account?.access?.kind === "pilot" || settlement.ready)});
}
