/* eslint-disable no-await-in-loop */

const yargs = require('yargs');
const config = require('./config');
const awsBulk = require('./aws/bulk.js');
const awsSpot = require('./aws/spot.js');

const allUpdaters = {
  aws: {
    bulk: awsBulk.updateBulk,
    spot: awsSpot.updateSpot,
  },
};

async function run() {
  const { argv } = yargs.usage('Usage: $0 --only=[aws:bulk,aws:spot]');

  const updaterConfigs = [];

  Object.entries(allUpdaters).forEach((updaterEntry) => {
    const [vendor, vendorUpdaters] = updaterEntry;
    Object.entries(vendorUpdaters).forEach((vendorUpdaterEntry) => {
      const [source, updaterFunc] = vendorUpdaterEntry;

      if (!argv.only || (argv.only && argv.only.split(',').includes(`${vendor}:${source}`))) {
        updaterConfigs.push({
          vendor,
          source,
          updaterFunc,
        });
      }
    });
  });

  for (const updaterConfig of updaterConfigs) {
    config.logger.info(`Running update function for ${updaterConfig.vendor}:${updaterConfig.source}`);
    await updaterConfig.updaterFunc();
  }
}

module.exports = {
  run,
};
