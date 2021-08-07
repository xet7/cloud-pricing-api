import express from 'express';
import _ from 'lodash';
import axios from 'axios';
import config from './config';
import { incrementCounters } from './stats/stats';

const router = express.Router();

router.post('/event', async (req, res) => {
  if (req.body.event === 'infracost-run') {
    const isCi = !!req.body?.env?.ciPlatform;
    const installId = req.body?.env?.installId;

    incrementCounters(isCi, installId);
  }

  if (!config.disableTelemetry) {
    await forwardEvent(req.body?.event || '', req.body?.env);
  }

  return res.json({ status: 'ok' });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
async function forwardEvent(event: string, env: any): Promise<void> {
  // Only forward run events
  if (event !== 'infracost-run') {
    return;
  }

  // Only forward the following attributes
  const attrs = ['ciPlatform', 'ciScript', 'fullVersion', 'installId'];

  const body = {
    event,
    env: {
      ..._.pick(env, attrs),
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
/* eslint-enable @typescript-eslint/no-explicit-any */
/* eslint-enable @typescript-eslint/explicit-module-boundary-types */

export default router;
