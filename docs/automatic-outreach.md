# Verified automatic business outreach

Owner authorized activation on October 6, 2026. Creator discovery and drafting remain separate; automatic delivery currently covers business prospects only.

Global Auto Hunt runs hourly. Inbox processing precedes follow-up. First contact runs after business discovery, inbox processing and follow-up. Each automatic pass uses a shared database lock, a shared maximum of five prospect provider attempts per clock hour across first contact, follow-up and reruns, and a combined daily quota of fifty prospect delivery attempts on the Istanbul calendar day. Existing manual sends count toward the day's automatic quota. A quota is a sending ceiling, not an expected number of contacts or sales.

Production config: OUTREACH_SEND_ENABLED=true, OUTREACH_DAILY_LIMIT=50, OUTREACH_CYCLE_LIMIT=5. Setting the enable flag false and redeploying pauses automated sends.

A public corporate address must have verified contact status, match the business domain, and appear on its official HTTPS contact page immediately before delivery. Private addresses, third-party directories, synthetic/test domains, identity conflicts, existing customers, prior first contact at the same address, and replied/lost records are withheld. Three contacts held in the October 6 recipient review (Berlin-Klinik, Audi Dental and DO & CO restaurant) remain subject to manual identity review. Unsupported scores, pricing, completed-audit or guaranteed-outcome claims are omitted from the automatic permission-request templates.

Replies stop follow-up across duplicate prospect addresses. Unprocessed inbox messages defer automated contact until sender matching is resolved. Follow-up needs a verified delivered/opened/clicked first provider event, is due after four days and then five more days, and is limited to two. A reply does not itself authorize an automatic substantive response: inbox response drafts remain under review.

Delivery keys and exact provider payloads are durable. Unknown sends are retried only within the existing provider idempotency window; older unknown sends require review. Failed contact-page checks are withheld and re-evaluated by later cycles. Authenticated scheduler failures get one network retry; fatal failures cause a failed job. Cycle reports and errors persist in outreach_cycle_reports and the shared agent event stream; the Communication Center displays the last five reports.

No bank movement, payment activation or automated purchase is part of this cycle.

## Comparative pool review

After discovery, qualification and opportunity agents compare the entire accumulated uncontacted business pool, not only the first 100 ready records. Specialist service/buyer descriptions with a matching official source, completed provider analysis, actionable recommendations and corporate contact records contribute to a transparent priority score. This is an ordering score, not a sales probability. Discovery-only or synthetic analyses cannot authorize sending. Pending analysis stays pending; deep-analysis budget remains unchanged.

Before each first-contact pass the complete pool is evaluated again, deduplicated by business domain and email, and up to 50 strongest ready candidates are shortlisted, further reduced by the remaining Istanbul daily quota. New evidence/new discoveries may refresh the unsent list on later passes. Responses, customers, prior contacts and invalid recipient identities are withheld. Actual sends still require fresh official-page verification. A smaller eligible pool produces a smaller list; 500 discoveries does not mean 500 audits or 50 guaranteed messages. Reports retain the assessed count, pending count, selected identities, priorities and selection reasons for review in the Communication Center.
