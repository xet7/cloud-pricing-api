const awsBulk = require('./aws/bulk.js');
const awsSpot = require('./aws/spot.js');

async function main() {
  await awsBulk.updateBulk();
  await awsSpot.updateSpot();
}

main();
