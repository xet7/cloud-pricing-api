const _ = require('lodash');
const { MongoClient } = require('mongodb');
const mingo = require('mingo');
const config = require('./config');

const productLimit = 1000;
const defaultOperation = '$eq';
const operationMapping = {
  regex: '$regex',
};

const strToRegex = (str) => {
  const main = str.match(/\/(.+)\/.*/)[1];
  const options = str.match(/\/.+\/(.*)/)[1];
  return new RegExp(main, options);
};


function transformProduct(product) {
  return {
    ..._.omit(product, 'attributes'),
    attributes: Object.entries(product.attributes).map(
      (f) => ({ key: f[0], value: f[1] }),
    ),
  };
}

function transformFilter(filter) {
  const transformed = {};
  if (!filter) {
    return transformed;
  }
  Object.entries(filter).forEach((filterItem) => {
    const keyPart = filterItem[0];
    let value = filterItem[1];
    const [key, operation] = keyPart.split('_');
    if (operation === 'regex') {
      value = strToRegex(value);
    }
    const transformedOperation = operationMapping[operation] || defaultOperation;
    transformed[key] = {};
    transformed[key][transformedOperation] = value;
  });
  return transformed;
}

function transformAttributeFilters(filters) {
  const transformed = {};
  if (!filters) {
    return transformed;
  }
  filters.forEach((filter) => {
    transformed[`attributes.${filter.key}`] = transformFilter(_.omit(filter, 'key')).value;
  });
  return transformed;
}

const resolvers = {
  Query: {
    products: async (_parent, args) => {
      const mongoClient = await MongoClient.connect(config.mongoDbUri, { useUnifiedTopology: true });
      const db = mongoClient.db();

      const products = await db.collection('products').find({
        ...transformFilter(_.omit(args.filter, 'attributeFilters')),
        ...transformAttributeFilters(args.filter.attributeFilters),
      }).limit(productLimit).toArray();

      mongoClient.close();

      return products.map((p) => transformProduct(p));
    },
  },
  Product: {
    prices: async (product, args) => {
      const prices = mingo.find(product.prices, transformFilter(args.filter));
      return prices;
    },
  },
};

module.exports = resolvers;
