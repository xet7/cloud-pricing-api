import express from 'express';
import format from 'pg-format';
import config from './config';

const router = express.Router();

router.get('/stats', async (_req, res) => {
  const pool = await config.pg();

  const sql = format(
    `
    SELECT created_at, prices_last_successfully_updated_at, prices_last_update_successful, total_runs, ci_runs, non_ci_runs, non_ci_installs
    FROM %I
    LIMIT 1`,
    config.statsTableName
  );

  const response = await pool.query(sql);
  const stats = response.rows[0] || {};

  return res.json(stats);
});

export default router;
