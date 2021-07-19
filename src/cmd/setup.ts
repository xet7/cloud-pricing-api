import config from '../config';
import { run } from '../db/setup';

run()
  .then(() => {
    config.logger.info('setup complete');
    process.exit(0);
  })
  .catch((err) => {
    config.logger.error(err);
    process.exit(1);
  });
