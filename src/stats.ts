import express from 'express';
import { fetchStats } from './stats/stats';

const router = express.Router();

router.get('/stats', async (_req, res) => {
  const stats = fetchStats();

  return res.json(stats);
});

export default router;
