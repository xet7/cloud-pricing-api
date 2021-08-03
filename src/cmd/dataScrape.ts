import yargs from 'yargs';
import config from '../config';
import awsBulk from '../scrapers/awsBulk';
import awsSpot from '../scrapers/awsSpot';
import azureRetail from '../scrapers/azureRetail';
import gcpCatalog from '../scrapers/gcpCatalog';
import gcpMachineTypes from '../scrapers/gcpMachineTypes';

interface ScraperConfig {
  vendor: string;
  source: string;
  scraperFunc: () => void;
}

const Scrapers = {
  aws: {
    bulk: awsBulk.scrape,
    spot: awsSpot.scrape,
  },
  azure: {
    retail: azureRetail.scrape,
  },
  gcp: {
    catalog: gcpCatalog.scrape,
    machineTypes: gcpMachineTypes.scrape,
  },
};

async function run(): Promise<void> {
  const { argv } = yargs
    .usage(
      'Usage: $0 --only=[aws:bulk,aws:spot,azure:retail,gcp:catalog,gcp:machineTypes]'
    )
    .options({
      only: { type: 'string' },
    });

  const scraperConfigs: ScraperConfig[] = [];

  Object.entries(Scrapers).forEach((scraperEntry) => {
    const [vendor, vendorScrapers] = scraperEntry;
    Object.entries(vendorScrapers).forEach((vendorScraperEntry) => {
      const [source, scraperFunc] = vendorScraperEntry;

      if (
        !argv.only ||
        (argv.only && argv.only.split(',').includes(`${vendor}:${source}`))
      ) {
        scraperConfigs.push({
          vendor,
          source,
          scraperFunc,
        });
      }
    });
  });

  for (const scraperConfig of scraperConfigs) {
    config.logger.info(
      `Running update function for ${scraperConfig.vendor}:${scraperConfig.source}`
    );
    await scraperConfig.scraperFunc();
  }
}

config.logger.info('Starting: scraping data from cloud vendors');
run()
  .then(() => {
    config.logger.info('Completed: scraping data from cloud vendors');
    process.exit(0);
  })
  .catch((err) => {
    config.logger.error(err);
    process.exit(1);
  });
