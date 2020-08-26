/* eslint-disable no-await-in-loop */

const _ = require('lodash');
const axios = require('axios');
const { MongoClient } = require('mongodb');
const config = require('../config.js');
const { generatePriceHash } = require('../utils/prices.js');

const ec2Url = 'https://website.spot.ec2.aws.a2z.com/spot.js';

const operatingSystemMapping = {
  linux: 'Linux',
  mswin: 'Windows',
};

const regionMapping = {
  'us-east': 'us-east-1',
  'us-west': 'us-west-1',
  'eu-ireland': 'eu-west-1',
  'apac-sin': 'ap-southeast-1',
  'apac-syd': 'ap-southeast-2',
  'apac-tokyo': 'ap-northeast-1',
  'us-west-2-lax-1a': 'us-west-2-lax-1',
};

function findProduct(db, region, instanceType, operatingSystem) {
  return db.collection('products').findOne({
    vendorName: 'aws',
    service: 'AmazonEC2',
    productFamily: { $in: ['Compute Instance', 'Compute Instance (bare metal)'] },
    region,
    'attributes.instanceType': instanceType,
    'attributes.operatingSystem': operatingSystem,
    'attributes.tenancy': { $in: ['Shared', 'Host'] },
    'attributes.capacitystatus': 'Used',
    'attributes.preInstalledSw': 'NA',
  });
}

async function updateProduct(db, product) {
  return db.collection('products').updateOne(
    {
      vendorName: 'aws',
      sku: product.sku,
    },
    { $set: product },
  );
}

async function loadEc2(db, jsonData) {
  config.logger.info('Loading data');
  const now = new Date();

  for (const regionData of jsonData.config.regions) {
    const region = regionMapping[regionData.region] || regionData.region;

    for (const sizeData of _.flatten(_.map(regionData.instanceTypes, 'sizes'))) {
      const instanceType = sizeData.size;

      for (const valueData of sizeData.valueColumns) {
        const operatingSystem = operatingSystemMapping[valueData.name];
        const usd = valueData.prices.USD;
        if (usd === 'N/A*') {
          continue;
        }
        const product = await findProduct(db, region, instanceType, operatingSystem);
        if (!product) {
          config.logger.warn(`SKIPPING: could not find an existing product for ${region}, ${instanceType}, ${operatingSystem}`);
          continue;
        }
        const existingSpotPrice = product.prices.find((p) => p.purchaseOption === 'spot');
        let newSpotPrice;

        if (existingSpotPrice) {
          if (existingSpotPrice.USD === usd) {
            continue;
          }
          existingSpotPrice.effectiveDateStart = now;
          existingSpotPrice.USD = usd;
        } else {
          const existingOnDemandPrice = product.prices.find((p) => p.purchaseOption === 'on_demand');
          newSpotPrice = {
            ...existingOnDemandPrice,
            purchaseOption: 'spot',
            USD: usd,
            effectiveDateStart: now,
            effectiveDateEnd: null,
          };

          newSpotPrice.priceHash = generatePriceHash(product.productHash, newSpotPrice);

          product.prices.push(newSpotPrice);
        }

        await updateProduct(db, product);
      }
    }
  }
}

async function downloadEc2() {
  config.logger.info(`Downloading ${ec2Url}`);
  const resp = await axios({
    method: 'get',
    url: ec2Url,
  });
  return JSON.parse(resp.data.replace(/^callback\(/, '').replace(/\);$/, ''));
}

async function updateSpot() {
  const jsonData = await downloadEc2();

  const mongoClient = await MongoClient.connect(config.mongoDbUri, { useUnifiedTopology: true });
  const db = mongoClient.db();

  await loadEc2(db, jsonData);

  mongoClient.close();
}

module.exports = {
  updateSpot,
};
