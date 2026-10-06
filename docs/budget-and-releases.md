# Budget and release policy

## Authorized spending

The owner has authorized a Vercel Pro platform budget of USD 20 per month. No additional deploying seats, paid add-ons, paid integrations, or higher plans are authorized. Increased revenue does not authorize an automatic upgrade; the owner will decide when to expand capacity.

Pro usage beyond its included credit is separately billed. The owner authorized USD 1 of additional metered usage per billing cycle and saved it with Pause Production Deployments enabled on October 6, 2026. A notification alone does not stop spending. Do not raise this budget automatically.

Spend Management is not an absolute invoice ceiling: checks may be delayed, and platform charges, additional seats, add-ons and separate provider bills are excluded. Pausing affects the entire team's production deployments. AI Gateway and v0 usage require separate controls. Direct Gemini, Perplexity, email, database and other provider bills must be checked independently.

Status as of October 6, 2026: the owner’s dashboard shows Pro Active and the successful budget-update confirmation; the budget table shows USD 1. The pause action was explicitly enabled and included in the saved confirmation. The dashboard also shows AI Gateway auto-reload off and Vercel Agent usage billing disabled. Observability Plus was disabled. SMS notification enrollment and custom early-usage alerts remain unverified. Card settlement has not been verified; an upcoming invoice is not proof of settlement. These controls are not a guarantee of a USD 21 total invoice ceiling.

## Release workflow

Automatic Git-triggered deployments are disabled through `git.deploymentEnabled: false` in `vercel.json`. Automatic preview deployments are also disabled in the Vercel project settings. GitHub CI remains enabled.

Group changes into tested releases, run appropriate checks, and deploy the chosen commit manually through Vercel after CI succeeds. Do not create a deployment for each small commit or repeatedly retry quota errors. If the quota is exhausted, retain the current working production deployment and wait for its reset or an authorized plan change.

These controls reduce unnecessary builds and deployment quota use. They do not cap production traffic, function usage or provider charges.

## Official references

- https://vercel.com/docs/plans/pro-plan
- https://vercel.com/docs/spend-management
- https://vercel.com/docs/project-configuration/git-configuration
