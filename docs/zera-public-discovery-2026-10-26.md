# ZERA public discovery — 2026-10-26 (research only)

This is a manually inspected **public web-search discovery snapshot**. It is NOT Google SERP telemetry, paid provider inference, a customer report, or a verified ZERA task completion. No production database mutation.

## Preliminary results
- Searching for the exact site and the combination “ZERA Clothing Wetzlar” did not yield an independently attributable ZERA profile in the returned sample. **Absence in this particular search sample does not establish absence from Google or other search engines.**
- A local business directory lists numerous apparel businesses in Wetzlar, without independently establishing that similarly named shops belong to the ZERA pilot: https://www.gelbeseiten.de/branchen/bekleidungsgesch%C3%A4fte/wetzlar
- Another local directory lists boutiques and apparel competitors: https://www.dasoertliche.de/Themen/Bekleidungsgesch%C3%A4fte/Wetzlar.html
- The Altstadt Wetzlar business association provides a separately attributable boutique profile for GÖTZL: https://altstadt-wetzlar.de/einkaufen/haendler/gotzl-zur-alten-munz

## Implications and safety
- Do not count these sources as any of the five configured Google tasks: query engine, location, ranking, and customer-identity verification have not been established.
- Do not claim a ZERA search score from this snapshot. Continue treating the pilot's verified task count as unconfirmed from production.
- Validate the customer-owned ze-ra.de site with the bounded collector after safe release; its response is first-party observation only, not Google position.
- Provider inference remains disabled or gated until cost, consent, and historical attempt checks are satisfied. Do not retry the prior Gemini attempt.
