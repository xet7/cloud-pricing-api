import axios, { AxiosResponse } from 'axios';
import config from '../config';
import fs from 'fs';
import yargs from 'yargs';

async function run() {
  const { argv } = yargs
  .usage(
    'Usage: $0 --out=[output file, default: ./data/products/products.csv.gz ]'
  )
  .options({
    out: { type: 'string', default: './data/products/products.csv.gz' },
  });
  
  let latestResp: AxiosResponse<{ downloadUrl: string }>;
  
  try {
    latestResp = await axios.get(`${config.baseCloudPricingEndpoint}/db-data/latest`, {
      headers: {
        'X-Api-Key': config.infracostAPIKey, 
      }
    });
  } catch (e) {
    if (e.response?.status === 403) {
      config.logger.error('You do not have permission to download data. Please set a INFRACOST_API_KEY.');
    } else {
      config.logger.error(`There was an error downloading data: ${e.message}`);
    }
    process.exit(1);
  }
  
  const downloadUrl = latestResp.data.downloadUrl;
  config.logger.debug(`Downloading dump from ${downloadUrl}`);
  
  const writer = fs.createWriteStream(argv.out);
  await axios({
    method: 'get',
    url: downloadUrl,
    responseType: 'stream'
  }).then(function (resp) {
    return new Promise((resolve, reject) => {
      resp.data.pipe(writer);
      
      let error: Error | null = null;
      writer.on('error', err => {
        error = err;
        writer.close();
        reject(err);
      });

      writer.on('close', () => {
        if (!error) {
          resolve(true);
        }
      });
    });
  });
}

config.logger.info('Starting: downloading DB data');
run()
  .then(() => {
    config.logger.info('Completed: downloading DB data');
    process.exit(0);
  })
  .catch((err) => {
    config.logger.error(err);
    process.exit(1);
  });
