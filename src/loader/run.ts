import glob from 'glob';
import fs from 'fs';
import zlib from 'zlib';
import { promisify } from 'util';
import { pipeline } from 'stream';

import { from as copyFrom } from 'pg-copy-streams';
import { PoolClient } from 'pg';
import format from 'pg-format';
import yargs from 'yargs';
import config from '../config';
import {
  createProductsTable,
  createProductsTableIndex,
  renameProductsTable,
} from '../db/setup';

async function run(): Promise<void> {
  const pool = await config.pg();

  const { argv } = yargs
    .usage(
      'Usage: $0 --path=[ location of *.csv.gz files, default: ./data/products ]'
    )
    .options({
      path: { type: 'string', default: './data/products' },
    });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await createProductsTable(client, 'ProductLoad');

    await loadFiles(argv.path, client);

    await createProductsTableIndex(client, 'ProductLoad');

    await replaceProductTable(client);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function replaceProductTable(client: PoolClient) {
  await client.query(
    format(`DROP TABLE IF EXISTS %I`, config.productTableName)
  );

  await renameProductsTable(client, 'ProductLoad', config.productTableName);
}

async function loadFiles(path: string, client: PoolClient): Promise<void> {
  const filenames = glob.sync(`${path}/*.csv.gz`);
  if (filenames.length === 0) {
    throw new Error(`No data files at '${path}/*.csv.gz'`);
  }

  for (const filename of filenames) {
    config.logger.info(`Loading file: ${filename}`);
    await loadFile(client, filename);
  }
}

async function loadFile(client: PoolClient, filename: string): Promise<void> {
  const promisifiedPipeline = promisify(pipeline);

  const gunzip = zlib.createGunzip().on('error', (e) => {
    config.logger.info(e);
    process.exit(1);
  });

  const pgCopy = client.query(
    copyFrom(`
    COPY "ProductLoad" FROM STDIN WITH (
      FORMAT csv, 
      HEADER true, 
      DELIMITER ',', 
      FORCE_NOT_NULL ("productFamily")
    )`)
  );

  return promisifiedPipeline(fs.createReadStream(filename), gunzip, pgCopy);
}

export default {
  run,
};
