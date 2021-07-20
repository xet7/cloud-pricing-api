import { PoolClient } from 'pg';
import format from 'pg-format';
import config from '../config';

const attempts = 10;
const backOffSecs = 10;

export async function run(): Promise<void> {
  const pool = await config.pg();

  let client: PoolClient | null = null;

  for (let i = 0; i < attempts; i++) {
    try {
      client = await pool.connect();
      break;
    } catch (e) {
      config.logger.error(
        `Waiting for PostgreSQL to become available: ${e.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, backOffSecs * 1000));
    }
  }

  if (client === null) {
    throw new Error('Failed to connect to PostgreSQL');
  }

  try {
    await client.query('BEGIN');

    await createProductsTable(client, config.productTableName, true);

    await createProductsTableIndex(client, config.productTableName, true);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function createProductsTable(
  client: PoolClient,
  tableName: string,
  ifNotExists?: boolean
): Promise<void> {
  await client.query(
    format(
      `
      CREATE TABLE ${ifNotExists ? 'IF NOT EXISTS' : ''} %I
      (
        "productHash" text,
        sku text NOT NULL,
        "vendorName" text NOT NULL,
        region text,
        service text NOT NULL,
        "productFamily" text DEFAULT ''::text NOT NULL,
        attributes jsonb NOT NULL,
        prices jsonb NOT NULL, 
        CONSTRAINT %I PRIMARY KEY("productHash")
      )   
    `,
      tableName,
      `${tableName}_pkey`
    )
  );
}

export async function createProductsTableIndex(
  client: PoolClient,
  tableName: string,
  ifNotExists?: boolean
): Promise<void> {
  await client.query(
    format(
      `CREATE INDEX ${
        ifNotExists ? 'IF NOT EXISTS' : ''
      } %I ON %I USING btree (service, region)`,
      `${tableName}_service_region_index`,
      tableName
    )
  );
}

export async function renameProductsTable(
  client: PoolClient,
  oldTableName: string,
  newTableName: string
): Promise<void> {
  await client.query(
    format(`ALTER TABLE %I RENAME TO %I`, oldTableName, newTableName)
  );
  await client.query(
    format(
      `ALTER INDEX %I RENAME TO %I`,
      `${oldTableName}_pkey`,
      `${newTableName}_pkey`
    )
  );
  await client.query(
    format(
      `ALTER INDEX %I RENAME TO %I`,
      `${oldTableName}_service_region_index`,
      `${newTableName}_service_region_index`
    )
  );
}
