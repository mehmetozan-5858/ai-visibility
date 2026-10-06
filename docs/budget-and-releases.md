# Budget and release policy

## Authorized spending

The owner has authorized a Vercel Pro platform budget of USD 20 per month. No additional deploying seats, paid add-ons, paid integrations, or higher plans are authorized. Increased revenue does not authorize an automatic upgrade; the owner will decide when to expand capacity.

Pro usage beyond its included credit is separately billed. Before upgrading, configure Spend Management with the lowest available on-demand budget and explicitly enable Pause Production Deployments. Verify the selected threshold with the owner if it permits additional charges. A notification alone does not stop spending.

Spend Management is not an absolute invoice ceiling: checks may be delayed, and platform charges, additional seats, add-ons and separate provider bills are excluded. Pausing affects the entire team's production deployments. AI Gateway and v0 usage require separate controls. Direct Gemini, Perplexity, email, database and other provider bills must be checked independently.

Status: the Pro purchase and Billing/Spend Management controls have not been completed or verified. Do not report the account as protected until the dashboard confirms them.

## Release workflow

Automatic Git-triggered deployments are disabled through `git.deploymentEnabled: false` in `vercel.json`. Automatic preview deployments are also disabled in the Vercel project settings. GitHub CI remains enabled.

Group changes into tested releases, run appropriate checks, and deploy the chosen commit manually through Vercel after CI succeeds. Do not create a deployment for each small commit or repeatedly retry quota errors. If the quota is exhausted, retain the current working production deployment and wait for its reset or an authorized plan change.

These controls reduce unnecessary builds and deployment quota use. They do not cap production traffic, function usage or provider charges.

## Official references

- https://vercel.com/docs/plans/pro-plan
- https://vercel.com/docs/spend-management
- https://vercel.com/docs/project-configuration/git-configuration
