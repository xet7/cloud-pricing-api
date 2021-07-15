import format from 'pg-format';
import { Product, Price } from './types';
import config from '../config';

const batchSize = 1000;

async function upsertProducts(products: Product[]): Promise<void> {
  const pool = await config.pg();

  const insertSql = format(
    `INSERT INTO %I ("productHash", "sku", "vendorName", "region", "service", "productFamily", "attributes", "prices") VALUES `,
    config.productTableName
  );

  const onConflictSql = format(
    ` 
    ON CONFLICT ("productHash") DO UPDATE SET
    "sku" = excluded."sku",
    "vendorName" = excluded."vendorName",
    "region" = excluded."region",
    "service" = excluded."service",
    "productFamily" = excluded."productFamily",
    "attributes" = excluded."attributes",
    "prices" = %I."prices" || excluded."prices"        
    `,
    config.productTableName
  );

  // const response = await pool.query(sql);

  const batchProducts: string[] = [];
  // const batchPrices: Prisma.PriceCreateManyInput[] = [];

  for (const product of products) {
    const pricesMap: { [priceHash: string]: Price[] } = {};

    product.prices.forEach((price) => {
      if (pricesMap[price.priceHash]) {
        pricesMap[price.priceHash].push(price);
      } else {
        pricesMap[price.priceHash] = [price];
      }
    });

    batchProducts.push(
      format(
        `(%L, %L, %L, %L, %L, %L, %L, %L)`,
        product.productHash,
        product.sku,
        product.vendorName,
        product.region,
        product.service,
        product.productFamily || '',
        product.attributes,
        pricesMap
      )
    );

    if (batchProducts.length > batchSize) {
      await pool.query(insertSql + batchProducts.join(',') + onConflictSql);
      batchProducts.length = 0;
    }
  }

  if (batchProducts.length > 0) {
    await pool.query(insertSql + batchProducts.join(',') + onConflictSql);
  }
}

async function upsertPrice(product: Product, price: Price): Promise<void> {
  const pool = await config.pg();

  await pool.query(
    format(
      `UPDATE %I SET "prices" = "prices" || %L WHERE "productHash" = %L`,
      config.productTableName,
      { [price.priceHash]: [price] },
      product.productHash
    )
  );
}

export { upsertProducts, upsertPrice };
