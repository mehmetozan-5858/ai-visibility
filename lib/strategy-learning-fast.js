import {databasePool} from './database-runtime';
import {getDatabaseUrl} from './db';

function normalizeDatabaseUrl(rawUrl){
 if(!rawUrl)return '';
 try{const url=new URL(rawUrl);const ssl=url.searchParams.get('sslmode');if(['prefer','require','verify-ca'].includes(ssl))url.searchParams.set('sslmode','verify-full');return url.toString()}catch{return rawUrl}
}

export async function refreshStrategyLearningFast(){
 const url=normalizeDatabaseUrl(getDatabaseUrl());if(!url)return [];
 const pool=databasePool(url);
 await pool.query(`CREATE TABLE IF NOT EXISTS strategy_learning (
  strategy_key TEXT PRIMARY KEY,country TEXT NOT NULL DEFAULT '',city TEXT NOT NULL DEFAULT '',sector TEXT NOT NULL DEFAULT '',package TEXT NOT NULL DEFAULT '',
  prospects INTEGER NOT NULL DEFAULT 0,contacted INTEGER NOT NULL DEFAULT 0,replies INTEGER NOT NULL DEFAULT 0,proposals INTEGER NOT NULL DEFAULT 0,wins INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,confidence NUMERIC NOT NULL DEFAULT 0,strategy_score NUMERIC NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 )`);
 const result=await pool.query(`
  WITH grouped AS (
   SELECT COALESCE(country,'') country,COALESCE(city,'') city,COALESCE(sector,'') sector,COALESCE(proposal_package,'') package,
    COUNT(*)::int prospects,
    COUNT(*) FILTER(WHERE communication_status='sent')::int contacted,
    COUNT(*) FILTER(WHERE COALESCE(reply_status,'')<>'')::int replies,
    COUNT(*) FILTER(WHERE COALESCE(proposal_package,'')<>'')::int proposals,
    COUNT(*) FILTER(WHERE crm_stage='won')::int wins
   FROM prospects GROUP BY 1,2,3,4
  ), revenue AS (
   SELECT COALESCE(p.country,'') country,COALESCE(p.city,'') city,COALESCE(p.sector,'') sector,COALESCE(p.proposal_package,'') package,
    COALESCE(SUM(pay.setup_amount+pay.monthly_amount),0)::numeric revenue
   FROM prospects p JOIN payments pay ON pay.client_id=p.client_id AND pay.status='paid'
   GROUP BY 1,2,3,4
  ), metrics AS (
   SELECT g.*,COALESCE(r.revenue,0)::numeric revenue,
    LEAST(100,ROUND(SQRT(g.prospects::numeric)*20))::numeric confidence,
    LEAST(100,
      (CASE WHEN g.contacted>0 THEN g.replies::numeric/g.contacted ELSE 0 END)*30 +
      (CASE WHEN g.proposals>0 THEN g.wins::numeric/g.proposals ELSE 0 END)*50 +
      LEAST(20,COALESCE(r.revenue,0)::numeric/1000)
    )::numeric raw_score
   FROM grouped g LEFT JOIN revenue r USING(country,city,sector,package)
  ), upserted AS (
   INSERT INTO strategy_learning(strategy_key,country,city,sector,package,prospects,contacted,replies,proposals,wins,revenue,confidence,strategy_score,updated_at)
   SELECT lower(country)||'|'||lower(city)||'|'||lower(sector)||'|'||lower(package),country,city,sector,package,prospects,contacted,replies,proposals,wins,revenue,confidence,
    ROUND(raw_score*(confidence/100),2),NOW()
   FROM metrics
   ON CONFLICT(strategy_key) DO UPDATE SET country=EXCLUDED.country,city=EXCLUDED.city,sector=EXCLUDED.sector,package=EXCLUDED.package,
    prospects=EXCLUDED.prospects,contacted=EXCLUDED.contacted,replies=EXCLUDED.replies,proposals=EXCLUDED.proposals,wins=EXCLUDED.wins,revenue=EXCLUDED.revenue,
    confidence=EXCLUDED.confidence,strategy_score=EXCLUDED.strategy_score,updated_at=NOW()
   RETURNING strategy_key AS "strategyKey",country,city,sector,package,prospects,contacted,replies,proposals,wins,revenue,confidence,strategy_score AS "strategyScore"
  ) SELECT * FROM upserted ORDER BY "strategyScore" DESC
 `);
 return result.rows||[];
}
