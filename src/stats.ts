import express from 'express';
import format from 'pg-format';
import config from './config';

const router = express.Router();

router.get('/stats', async (_req, res) => {
  const pool = await config.pg();

  const sql = format(
    `
    SELECT
      stats.created_at,
      stats.prices_last_successfully_updated_at,
      stats.prices_last_update_successful,
      stats.total_runs,
      stats.ci_runs,
      stats.non_ci_runs,
      (SELECT COUNT(installs.install_id) FROM %I) as non_ci_installs
    FROM %I as stats
    LIMIT 1
    `,
    config.installsTableName,
    config.statsTableName
  );

  const response = await pool.query(sql);
  const stats = response.rows[0] || {};

  return res.json(stats);
});

export default router;
