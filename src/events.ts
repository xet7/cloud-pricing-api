import express, { Request } from 'express';
import _ from 'lodash';
import axios from 'axios';
import format from 'pg-format';
import config from './config';

const router = express.Router();

router.post('/event', async (req, res) => {
  // Store the counters
  if (req.body.event === 'infracost-run') {
    incrementCounters(req);
  }

  // Forward events to Dashboard
  if (!config.disableTelemetry && req.body.event === 'infracost-run') {
    const attrs = ['ciPlatform', 'ciScript', 'fullVersion', 'installId'];

    const body = {
      event: req.body.event,
      env: {
        ..._.pick(req.body.env, attrs),
        isSelfHosted: true,
      },
    };

    await axios.post(`${config.infracostDashboardApiEndpoint}/event`, body, {
      headers: {
        'X-Api-Key': config.infracostAPIKey,
        'X-Cloud-Pricing-Api-Version': process.env.npm_package_version,
      },
    });
  }

  return res.json({ status: 'ok' });
});

async function incrementCounters(req: Request) {
  const isCI = !!req.body?.env?.ciPlatform;
  const installId = req.body?.env?.installId;

  let isNewNonCIInstall = false;

  const pool = await config.pg();

  if (!isCI && installId) {
    const sql = format(
      `
      INSERT INTO %I (install_id) VALUES (%L)
      ON CONFLICT (install_id) DO NOTHING`,
      config.installsTableName,
      installId
    );

    const response = await pool.query(sql);
    isNewNonCIInstall = response.rowCount > 0;
  }

  const sql = format(
    `UPDATE %I SET \
    updated_at = NOW(),
    total_runs = total_runs + 1
    ${isCI ? ', ci_runs = ci_runs + 1' : ', non_ci_runs = non_ci_runs + 1'}
    ${isNewNonCIInstall ? ', non_ci_installs = non_ci_installs + 1' : ''}`,
    config.statsTableName
  );

  await pool.query(sql);
}

export default router;
