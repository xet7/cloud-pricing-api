import dotenv from 'dotenv';
import pino from 'pino';
import { MongoClient, Db } from 'mongodb';
import NodeCache from 'node-cache';
import { Pool, PoolConfig } from 'pg';
import tmp from 'tmp';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config();

const createPaths = [
  path.join(__dirname, '../data'),
  path.join(__dirname, '../data/products'),
];

createPaths.forEach((path) => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }
});

let client: MongoClient;

async function setupDb(db: Db): Promise<void> {
  db.collection('products').createIndex({ vendorName: 1, sku: 1 });
  db.collection('products').createIndex({ productHash: 1 }, { unique: true });
  db.collection('products').createIndex({
    vendorName: 1,
    service: 1,
    productFamily: 1,
    region: 1,
  });
  db.collection('products').createIndex({
    vendorName: 1,
    service: 1,
    productFamily: 1,
    region: 1,
    'attributes.instanceType': 1,
    'attributes.tenancy': 1,
    'attributes.operatingSystem': 1,
    'attributes.capacitystatus': 1,
    'attributes.preInstalledSw': 1,
  });
  db.collection('products').createIndex({
    vendorName: 1,
    service: 1,
    productFamily: 1,
    region: 1,
    'attributes.instanceType': 1,
    'attributes.deploymentOption': 1,
    'attributes.databaseEngine': 1,
    'attributes.databaseEdition': 1,
  });
}

async function db(): Promise<Db> {
  if (!client) {
    client = await MongoClient.connect(config.mongoDbUri, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
      poolSize: 10,
    });
    await setupDb(client.db());
  }
  return client.db();
}

let pgPool: Pool;
async function pg(): Promise<Pool> {
  if (!pgPool) {
    let poolConfig: PoolConfig = {
      user: process.env.POSTGRES_USER || 'postgres',
      database: process.env.POSTGRES_DB || 'cloudPricing',
      password: process.env.POSTGRES_PASSWORD || 'my_password',
      port: Number(process.env.POSTGRES_PORT) || 5432,
      host: process.env.POSTGRES_HOST || 'localhost',
      max: Number(process.env.POSTGRES_MAX_CLIENTS) || 10,
    };

    if (process.env.POSTGRES_URI) {
      poolConfig = {
        connectionString:
          process.env.POSTGRES_URI ||
          'postgresql://postgres:my_password@localhost:5432/cloudPricing',
      };
    }

    pgPool = new Pool(poolConfig);
  }
  return pgPool;
}

function generateGcpKeyFile(): string {
  if (process.env.GCP_KEY_FILE) {
    return process.env.GCP_KEY_FILE;
  }

  const tmpFile = tmp.fileSync({ postfix: '.json' });
  tmp.setGracefulCleanup();

  fs.writeFileSync(tmpFile.name, process.env.GCP_KEY_FILE_CONTENT || '');
  return tmpFile.name;
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  prettyPrint: process.env.NODE_ENV !== 'production',
});

const cache = new NodeCache();

const config = {
  logger,
  db,
  pg,
  productTableName: 'Product',
  baseCloudPricingEndpoint:
    process.env.BASE_CLOUD_PRICING_ENDPOINT ||
    'https://pricing.api.infracost.io',
  infracostAPIKey: process.env.INFRACOST_API_KEY,
  cache,
  port: Number(process.env.PORT) || 4000,
  gcpApiKey: process.env.GCP_API_KEY,
  gcpKeyFile: generateGcpKeyFile(),
  gcpProject: process.env.GCP_PROJECT,
  mongoDbUri:
    process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudPricing',
};

export default config;
