/* eslint-disable no-await-in-loop */

const fs = require('fs');
const _ = require('lodash');
const axios = require('axios');
const { MongoClient } = require('mongodb');
const glob = require('glob');
const config = require('../config.js');

const baseUrl = 'https://pricing.us-east-1.amazonaws.com';
const indexUrl = '/offers/v1.0/aws/index.json';
const batchSize = 1000;

const splitByRegions = ['AmazonEC2'];

const regionMapping = {
  'AWS GovCloud (US)': 'us-gov-west-1',
  'AWS GovCloud (US-West)': 'us-gov-west-1',
  'AWS GovCloud (US-East)': 'us-gov-east-1',
  'US East (N. Virginia)': 'us-east-1',
  'US East (Ohio)': 'us-east-2',
  'US West (N. California)': 'us-west-1',
  'US West (Oregon)': 'us-west-2',
  'US West (Los Angeles)': 'us-west-2-lax-1',
  'US ISO East': 'us-iso-east-1',
  'US ISOB East (Ohio)': ' us-isob-east-1',
  'Canada (Central)': 'ca-central-1',
  'China (Beijing)': 'cn-north-1',
  'China (Ningxia)': 'cn-northwest-1',
  'EU (Frankfurt)': 'eu-central-1',
  'EU (Ireland)': 'eu-west-1',
  'EU (London)': 'eu-west-2',
  'EU (Milan)': 'eu-south-1',
  'EU (Paris)': 'eu-west-3',
  'EU (Stockholm)': 'eu-north-1',
  'Asia Pacific (Hong Kong)': 'ap-east-1',
  'Asia Pacific (Tokyo)': 'ap-northeast-1',
  'Asia Pacific (Seoul)': 'ap-northeast-2',
  'Asia Pacific (Osaka-Local)': 'ap-northeast-3',
  'Asia Pacific (Singapore)': 'ap-southeast-1',
  'Asia Pacific (Sydney)': 'ap-southeast-2',
  'Asia Pacific (Mumbai)': 'ap-south-1',
  'Middle East (Bahrain)': 'me-south-1',
  'South America (Sao Paulo)': 'sa-east-1',
  'Africa (Cape Town)': 'af-south-1',
};

async function downloadService(offer) {
  if (_.includes(splitByRegions, offer.offerCode)) {
    const regionResp = await axios.get(`${baseUrl}${offer.currentRegionIndexUrl}`);
    for (const region of Object.values(regionResp.data.regions)) {
      config.logger.info(`Downloading ${region.currentVersionUrl}`);
      const resp = await axios({
        method: 'get',
        url: `${baseUrl}${region.currentVersionUrl}`,
        responseType: 'stream',
      });
      const writer = fs.createWriteStream(`data/${offer.offerCode}-${region.regionCode}.json`);
      resp.data.pipe(writer);
      await new Promise((resolve) => {
        writer.on('finish', resolve);
      });
    }
  } else {
    config.logger.info(`Downloading ${offer.currentVersionUrl}`);
    const resp = await axios({
      method: 'get',
      url: `${baseUrl}${offer.currentVersionUrl}`,
      responseType: 'stream',
    });
    const writer = fs.createWriteStream(`data/${offer.offerCode}.json`);
    resp.data.pipe(writer);
    await new Promise((resolve) => {
      writer.on('finish', resolve);
    });
  }
}

async function downloadAll() {
  const indexResp = await axios.get(`${baseUrl}${indexUrl}`);
  for (const offer of Object.values(indexResp.data.offers)) {
    await downloadService(offer);
  }
}

function parsePrices(priceData, purchaseOption) {
  const prices = [];

  Object.values(priceData).forEach((priceItem) => {
    Object.values(priceItem.priceDimensions).forEach((priceDimension) => {
      const price = {
        purchaseOption,
        unit: priceDimension.unit,
        USD: priceDimension.pricePerUnit.USD,
        effectiveDateStart: priceItem.effectiveDate,
        effectiveDateEnd: null,
        startUsageAmount: priceDimension.startingRange,
        endUsageAmount: priceDimension.endingRange,
        description: priceDimension.description,
      };

      if (purchaseOption === 'reserved') {
        Object.assign(price, {
          termLength: priceItem.termAttributes && priceItem.termAttributes.LeaseContractLength,
          termPurchaseOption: priceItem.termAttributes && priceItem.termAttributes.PurchaseOption,
          termOfferingClass: priceItem.termAttributes && priceItem.termAttributes.OfferingClass,
        });
      }

      prices.push(price);
    });
  });

  return prices;
}

function parseProduct(productData, onDemandPriceData, reservedPriceData) {
  const prices = [];
  if (onDemandPriceData) {
    prices.push(...parsePrices(onDemandPriceData, 'on_demand'));
  }
  if (reservedPriceData) {
    prices.push(...parsePrices(reservedPriceData, 'reserved'));
  }

  return {
    vendorName: 'aws',
    service: productData.attributes.servicecode,
    productFamily: productData.productFamily,
    region: regionMapping[productData.attributes.location] || null,
    sku: productData.sku,
    attributes: productData.attributes,
    prices,
  };
}

async function processFile(file, db) {
  const data = JSON.parse(fs.readFileSync(file));
  const promises = [];

  let batchUpdates = [];
  Object.values(data.products).forEach((productData) => {
    let onDemandPriceData = null;
    let reservedPriceData = null;

    if (data.terms.OnDemand && data.terms.OnDemand[productData.sku]) {
      onDemandPriceData = Object.values(data.terms.OnDemand[productData.sku]);
    }

    if (data.terms.Reserved && data.terms.Reserved[productData.sku]) {
      reservedPriceData = Object.values(data.terms.Reserved[productData.sku]);
    }

    const product = parseProduct(productData, onDemandPriceData, reservedPriceData);

    batchUpdates.push({
      updateOne: {
        filter: {
          vendorName: product.vendorName,
          sku: product.sku,
        },
        update: {
          $set: product,
        },
        upsert: true,
      },
    });

    if (batchUpdates.length >= batchSize) {
      promises.push(db.collection('products').bulkWrite(batchUpdates));
      batchUpdates = [];
    }
  });

  promises.push(db.collection('products').bulkWrite(batchUpdates));
  await Promise.all(promises);
}

async function loadAll() {
  const mongoClient = await MongoClient.connect(config.mongoDbUri, { useUnifiedTopology: true });
  const db = mongoClient.db();
  db.collection('products').createIndex({ vendorName: 1, sku: 1 });
  db.collection('products').createIndex({
    vendorName: 1, service: 1, productFamily: 1, region: 1,
  });
  db.collection('products').createIndex({
    vendorName: 1, service: 1, productFamily: 1, region: 1, 'attributes.instanceType': 1, 'attributes.tenancy': 1, 'attributes.operatingSystem': 1, 'attributes.capacitystatus': 1, 'attributes.preInstalledSw': 1,
  });
  db.collection('products').createIndex({
    vendorName: 1, service: 1, productFamily: 1, region: 1, 'attributes.instanceType': 1, 'attributes.deploymentOption': 1, 'attributes.databaseEngine': 1, 'attributes.databaseEdition': 1,
  });

  for (const file of glob.sync('data/*.json')) {
    config.logger.info(`Processing file: ${file}`);
    try {
      await processFile(file, db);
    } catch (e) {
      config.logger.error(`Skipping file ${file} due to error ${e}`);
      config.logger.error(e.stack);
    }
  }

  mongoClient.close();
}

async function updateBulk() {
  await downloadAll();
  await loadAll();
}

module.exports = {
  updateBulk,
};
