// Explicit opt-in operator probe; never part of npm test or deployed routes.
// GET /api/v1/key performs authentication without invoking a model.
import {checkOpenRouterKeyReadiness} from '../lib/openrouter-key-readiness-review.mjs';
const result=await checkOpenRouterKeyReadiness();
// Intentionally output only coarse status, never tokens, account usage or key labels.
process.stdout.write(JSON.stringify(result)+'\n');
if(result.status!=='recent-evidence')process.exitCode=1;
