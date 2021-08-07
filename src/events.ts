import express from 'express';
import _ from 'lodash';
import axios from 'axios';
import config from './config';
import { incrementCounters } from './stats/stats';

const router = express.Router();

router.post('/event', async (req, res) => {
  // Store the counters
  if (req.body.event === 'infracost-run') {
    const isCi = !!req.body?.env?.ciPlatform;
    const installId = req.body?.env?.installId;

    incrementCounters(isCi, installId);
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

export default router;
