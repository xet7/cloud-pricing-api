import fs from 'fs';
import path from 'path';
import config from '../config';
import dumper from '../dumper/run';

const dir = path.join(__dirname, '../../data/products');

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

async function run() {
  await dumper.run();
}

run()
  .then(() => {
    config.logger.info('dump complete');
    process.exit(0);
  })
  .catch((err) => {
    config.logger.error(err);
    process.exit(1);
  });
