import fs from 'fs';
import axios from 'axios';
import glob from 'glob';
import config from '../config';
import { Product, Price } from '../db/types';
import { generateProductHash, generatePriceHash } from '../db/helpers';
import { upsertProducts } from '../db/upsert';

const baseUrl = 'https://prices.azure.com/api/retail/prices';

const regionMapping: { [key: string]: string } = {
  'East US'                   : 'eastus',
  'East US 2'                 : 'eastus2',
  'South Central US'          : 'southcentralus',
  'West US 2'                 : 'westus2',
  'Australia East'            : 'australiaeast',
  'Southeast Asia'            : 'southeastasia',
  'North Europe'              : 'northeurope',
  'UK South'                  : 'uksouth',
  'West Europe'               : 'westeurope',
  'Central US'                : 'centralus',
  'North Central US'          : 'northcentralus',
  'West US'                   : 'westus',
  'South Africa North'        : 'southafricanorth',
  'Central India'             : 'centralindia',
  'East Asia'                 : 'eastasia',
  'Japan East'                : 'japaneast',
  'Korea Central'             : 'koreacentral',
  'Canada Central'            : 'canadacentral',
  'France Central'            : 'francecentral',
  'Germany West Central'      : 'germanywestcentral',
  'Norway East'               : 'norwayeast',
  'Switzerland North'         : 'switzerlandnorth',
  'UAE North'                 : 'uaenorth',
  'Brazil South'              : 'brazilsouth',
  'Central US (Stage)'        : 'centralusstage',
  'East US (Stage)'           : 'eastusstage',
  'East US 2 (Stage)'         : 'eastus2stage',
  'North Central US (Stage)'  : 'northcentralusstage',
  'South Central US (Stage)'  : 'southcentralusstage',
  'West US (Stage)'           : 'westusstage',
  'West US 2 (Stage)'         : 'westus2stage',
  'Asia'                      : 'asia',
  'Asia Pacific'              : 'asiapacific',
  'Australia'                 : 'australia',
  'Brazil'                    : 'brazil',
  'Canada'                    : 'canada',
  'Europe'                    : 'europe',
  'Global'                    : 'global',
  'India'                     : 'india',
  'Japan'                     : 'japan',
  'United Kingdom'            : 'uk',
  'United States'             : 'unitedstates',
  'East Asia (Stage)'         : 'eastasiastage',
  'Southeast Asia (Stage)'    : 'southeastasiastage',
  'Central US EUAP'           : 'centraluseuap',
  'East US 2 EUAP'            : 'eastus2euap',
  'West Central US'           : 'westcentralus',
  'West US 3'                 : 'westus3',
  'South Africa West'         : 'southafricawest',
  'Australia Central'         : 'australiacentral',
  'Australia Central 2'       : 'australiacentral2',
  'Australia Southeast'       : 'australiasoutheast',
  'Japan West'                : 'japanwest',
  'Korea South'               : 'koreasouth',
  'South India'               : 'southindia',
  'West India'                : 'westindia',
  'Canada East'               : 'canadaeast',
  'France South'              : 'francesouth',
  'Germany North'             : 'germanynorth',
  'Norway West'               : 'norwaywest',
  'Switzerland West'          : 'switzerlandwest',
  'UK West'                   : 'ukwest',
  'UAE Central'               : 'uaecentral',
  'Brazil Southeast'          : 'brazilsoutheast',
};

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
};

async function update(): Promise<void> {
    await downloadAll();
    await loadAll();
}

async function loadAll(): Promise<void> {
    config.logger.info(`Loading Azure Pricing Items...`);
    for (const filename of glob.sync('data/az-items-*.json')) {
        try {
            await processFile(filename);
        } catch (e) {
            config.logger.error(`Skipping file ${filename} due to error ${e}`);
            config.logger.error(e.stack);
        }
    }
}

async function downloadAll(): Promise<PageJson[]> {
    config.logger.info(`Downloading Azure Pricing API Pages...`);

    const pages: PageJson[] = [];

    let count = 100;
    let currentPageLink = '';
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

        let filename = `az-items-${currentPageLink}`;
        filename = filename.replace(/\//g, '-').replace(/\./g, '-').replace(/:/g, '-');
        filename = `data/${filename}.json`;

        const dataString = JSON.stringify(resp.data)
        fs.writeFile(filename, dataString, (err) => {
            if (err) throw err;
        });

        count = resp.data.Count;
        currentPageLink = resp.data.NextPageLink;

    } while (count === 100);

    return pages;
}

async function processFile(filename: string): Promise<void> {
    config.logger.info(`Processing File ${filename}`);
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
        sku: productJson.skuName,
        vendorName: 'azure',
        region: regionMapping[productJson.location] || productJson.location,
        service: productJson.serviceName,
        productFamily: productJson.serviceFamily,
        attributes: {
            type: productJson.type,
            effectiveStartDate: productJson.effectiveStartDate,
            meterId: productJson.meterId,
            meterName: productJson.meterName,
            skuID: productJson.skuId,
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
        startUsageAmount: productJson.tierMinimumUnits
    };

    price.priceHash = generatePriceHash(product, price);

    prices.push(price);

    return prices;
}

export default {
    update,
};
