const _ = require('lodash');
const crypto = require('crypto');

module.exports = {
  generateProductHash(product) {
    const hashableValues = _.values(_.pick(product, ['vendorName', 'sku']));
    return crypto.createHash('md5').update(hashableValues.join('-')).digest('hex');
  },

  generatePriceHash(productHash, price) {
    const hashableValues = _.values(_.pick(price, ['purchaseOption', 'unit', 'termLength', 'termPurchaseOption', 'termOfferingClass']));
    const hash = crypto.createHash('md5').update(hashableValues.join('-')).digest('hex');
    return `${productHash}-${hash}`;
  },
};
