import express, { Request } from 'express';
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

  await forwardEvent(req);

  return res.json({ status: 'ok' });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
async function forwardEvent(req: Request): Promise<void> {
  if (config.disableTelemetry) {
    return;
  }

  // Only forward run events
  if (req.body?.event !== 'infracost-run') {
    return;
  }

  // Only forward the following attributes
  const attrs = ['ciPlatform', 'ciScript', 'fullVersion', 'installId', 'version'];

  const body = {
    event: req.body.event,
    env: {
      ..._.pick(req.body?.env || {}, attrs),
      isSelfHosted: true,
    },
  };

  try {
    await axios.post(`${config.infracostDashboardApiEndpoint}/event`, body, {
      headers: {
        'X-Api-Key': config.infracostAPIKey,
        'X-Cloud-Pricing-Api-Version': process.env.npm_package_version,
      },
    });
  } catch (err) {
    config.logger.error(`Error forwarding event to Infracost API: ${err}`);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
/* eslint-enable @typescript-eslint/explicit-module-boundary-types */

export default router;
