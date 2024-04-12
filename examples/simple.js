const Aggregator = require('../lib/aggregator.ts');

const aggregator = new Aggregator();
aggregator.add('test');
const result = aggregator.get();
console.log(result);
