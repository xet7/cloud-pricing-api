import fs from 'fs';
import axios from 'axios';
import glob from 'glob';
import config from '../config';
import { Product, Price } from '../db/types';
import { generateProductHash, generatePriceHash } from '../db/helpers';
import { upsertProducts } from '../db/upsert';

const baseUrl = 'https://prices.azure.com/api/retail/prices';

type ItemsJson = {
  Items: ProductJson[];
  nextPageToken: string;
};

type PageJson = {
  currentPageLink: string;
  nextPageLink: string;
  count: string;
};

type ProductJson = {
  currencyCode: string;
  tierMinimumUnits: string;
  retailPrice: string;
  unitPrice: string;
  armRegionName: string;
  location: string;
  effectiveStartDate: string;
  meterId: string;
  meterName: string;
  productId: string;
  skuId: string;
  productName: string;
  skuName: string;
  serviceName: string;
  serviceId: string;
  serviceFamily: string;
  unitOfMeasure: string;
  type: string;
  isPrimaryMeterRegion: boolean;
  armSkuName: string;
  reservationTerm: string;
};

async function update(): Promise<void> {
  await downloadAll();
  await loadAll();
}

async function downloadAll(): Promise<PageJson[]> {
  config.logger.info(`Downloading Azure Pricing API Pages...`);

  const pages: PageJson[] = [];

  let count = 100;
  let currentPageLink = '';
  let pageNumber = 1;
  do {

    if (!currentPageLink) {
      currentPageLink = `${baseUrl}`;
    }

    const resp = await axios.get(currentPageLink);

    const page: PageJson = {
      currentPageLink: `${currentPageLink}`,
      nextPageLink: resp.data.NextPageLink,
      count: resp.data.Count,
    };
    pages.push(page);

    let filename = `data/az-retail-page-${pageNumber}.json`;

    const dataString = JSON.stringify(resp.data)
    fs.writeFile(filename, dataString, (err) => {
      if (err) throw err;
    });

    count = resp.data.Count;
    currentPageLink = resp.data.NextPageLink;

    pageNumber += 1
    if (pageNumber % 100 === 0) {
      config.logger.info(`Downloaded ${pageNumber} pages...`);
    }

  } while (count === 100);

  return pages;
}

async function loadAll(): Promise<void> {
  config.logger.info(`Loading Azure Pricing Items...`);
  for (const filename of glob.sync('data/az-retail-page-*.json')) {
    try {
      await processFile(filename);
    } catch (e) {
      config.logger.error(`Skipping file ${filename} due to error ${e}`);
      config.logger.error(e.stack);
    }
  }
}

async function processFile(filename: string): Promise<void> {
  config.logger.info(`Processing file ${filename}`);
  const body = fs.readFileSync(filename);
  const json = <ItemsJson>JSON.parse(body.toString());

  const products = Object.values(json.Items).map((productJson) => {
    const product = parseProduct(productJson);
    return product;
  });

  await upsertProducts(products);
}

function parseProduct(productJson: ProductJson): Product {
  const product: Product = {
    productHash: '',
    sku: productJson.skuId,
    vendorName: 'azure',
    region: productJson.armRegionName || null,
    service: productJson.serviceName,
    productFamily: productJson.serviceFamily,
    attributes: {
      effectiveStartDate: productJson.effectiveStartDate,
      meterId: productJson.meterId,
      meterName: productJson.meterName,
      productID: productJson.productId,
      productName: productJson.productName,
      serviceID: productJson.serviceId,
      skuName: productJson.skuName,
      type: productJson.type,
    },
    prices: [],
  };

  product.productHash = generateProductHash(product);
  product.prices = parsePrices(product, productJson);

  return product;
}

function parsePrices(product: Product, productJson: ProductJson): Price[] {
  const prices: Price[] = [];

  const price: Price = {
    priceHash: '',
    purchaseOption: productJson.type,
    unit: productJson.unitOfMeasure,
    USD: `${productJson.unitPrice}`,
    effectiveDateStart: productJson.effectiveStartDate,
    startUsageAmount: productJson.tierMinimumUnits,
  };

  price.priceHash = generatePriceHash(product, price);

  prices.push(price);

  return prices;
}

export default {
  update,
};
